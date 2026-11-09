---
layout: post
title: "CPU 99% 인데 범인은 CPU 가 아니었다 — 소켓 서버의 임시 포트 고갈"
date: 2026-06-17 21:00:00+0900
description: nginx 가 CPU 를 다 쓰던 실시간 서버 장애를, 코드 한 줄 없이 커널 네트워크 설정으로 푼 과정과 그 설정이 조용히 사라진 후일담
tags: troubleshooting performance infra
categories: blog
---

## 증상

실시간 대시보드용 socket.io 서버(소형 VM 1대)에서 아침 9시 20분쯤부터 CPU 가 오르기 시작해, 9시 50분에는 **99.9% 로 고정**됐습니다. 메모리와 디스크는 정상이었습니다.

- `top` 을 보니 CPU 를 다 쓰는 것은 Node 가 아니라 **nginx worker 4개**(각 88~97%)였습니다. Node 는 17% 였습니다.
- 브라우저의 socket.io 요청은 WebSocket 이 아니라 **`transport=polling`** 으로 몰려 있었고, 타임아웃과 실패가 많았습니다.
- 동시 연결 수가 9천 → 2만 → 3만 이상까지 올랐다가, 한꺼번에 끊겨 0 근처로 떨어지기를 반복했습니다.

구성은 이렇습니다.

```
브라우저 → nginx(컨테이너) → docker-proxy(호스트) → Node(socket.io, 단일 프로세스)
```

## 관측 사실

- `ss`: 연결 상태 중 closed 가 약 3만 개였습니다. 연결이 생겼다 사라지는 속도(churn)가 컸습니다.
- `nstat`: ListenOverflows/ListenDrops 약 188만, SyncookiesSent 11.6만.
- `dmesg`: `Possible SYN flooding on port ... Sending cookies` 반복.
- Node: 이벤트 루프 지연 p95 가 181ms → 618ms 로 올랐지만, 재시작이나 OOM 은 없었고 에러 로그도 비어 있었습니다.

## 원인 후보

1. **accept 큐 넘침 + 임시(ephemeral) 포트 고갈** — 채택.
2. **Node 단일 스레드의 처리 한계** — 기각. 튜닝 후 같은 단일 Node 가 3만 3천 연결을 이벤트 루프 p95 6.75ms, CPU idle 89% 로 버텼습니다. p95 618ms 는 원인이 아니라 I/O 가 굶은 결과였습니다.
3. **Node 크래시 루프** — 기각. 재시작 횟수와 업타임이 변하지 않았고, OOM 도 없었습니다.

## 메커니즘

1. polling 클라이언트는 요청마다 짧은 HTTP 연결을 만듭니다. 그래서 nginx 가 Node 로 여는 연결(업스트림)이 짧게 살다 죽기를 폭발적으로 반복합니다.
2. nginx → Node 연결은 **목적지가 항상 같은 IP 와 포트**입니다. 연결을 구분하는 변수는 nginx 쪽 **임시 포트**뿐이고, 리눅스 기본 범위(32768~60999)는 약 2.8만 개입니다.
3. 닫힌 연결은 `TIME_WAIT` 상태로 약 60초 동안 포트를 붙잡습니다. churn 이 크면 "사용 중 + TIME_WAIT" 가 범위를 넘고, 새 연결이 포트를 못 받습니다.
4. 실패한 클라이언트는 재시도하고, 재시도가 다시 부하를 만듭니다. 동시에 accept 큐(docker-proxy 4096, Node 511)도 넘쳐 SYN 이 버려지고 syncookie 가 발동합니다.
5. nginx 는 실패와 재시도를 처리하느라 CPU 를 다 씁니다. **경보에 찍힌 CPU 99% 는 증상이었고, 원인은 OS 한도**였습니다.

솔직하게 적어 두면, 튜닝 전에 포트 사용량을 직접 세지는 못했습니다. "포트 고갈이 마지막 병목"이라는 판단은 단계별 튜닝 전후의 변화에서 나온 것입니다.

## 수정: 코드 변경 0줄

세 가지 방향을 비교했습니다.

- **A. OS 네트워크 튜닝** — 코드 변경이 없고, 즉시 적용할 수 있고, 되돌리기 쉽습니다. 채택.
- **B. Node 스케일아웃(cluster + Redis adapter + sticky session)** — 코드와 배포가 필요하고, 진단상 Node 가 병목이 아니었습니다. 장기 옵션으로 보류.
- **C. 일부 사용자의 기능 차단(load shedding)** — 제품 결정이 필요하고 A 로 해결돼 불필요했습니다.

적용은 두 단계로 나눠 했습니다.

```bash
# 1단계: 큐를 키운다 (호스트)
sysctl -w net.core.somaxconn=65535
sysctl -w net.ipv4.tcp_max_syn_backlog=65535
# nginx:  listen <port> reuseport backlog=65535;

# 2단계: 임시 포트를 넓히고 TIME_WAIT 재사용 (nginx 컨테이너 netns)
#   net.ipv4.ip_local_port_range = "1024 65535"
#   net.ipv4.tcp_tw_reuse = 1
```

- docker-proxy 는 **호스트 쪽에서 별도로 listen** 합니다. 컨테이너 안의 nginx 만 튜닝해서는 부족하고, 호스트 값을 바꾼 뒤 컨테이너를 다시 만들어야 새 backlog 로 bind 됩니다.
- `tcp_tw_reuse` 는 나가는 연결(nginx → Node)에만 효과가 있습니다.
- 포트 범위는 컨테이너 네임스페이스에만 넓혔습니다. 호스트 범위를 1024 까지 내리면 앱의 listen 포트와 겹칠 수 있기 때문입니다.

1단계 뒤에도 연결 수가 약 6,500 근처에서 출렁였고 ListenOverflows 가 10초에 1,651씩 늘었습니다. 이때 "이제 Node 한계다"라고 성급하게 해석할 뻔했습니다. 포트 범위를 넓힌 2단계가 마지막 병목을 풀었습니다.

## 결과

- docker-proxy backlog: 4096 → 65535
- nginx CPU(1단계): 360% → 25%
- 최대 동시 연결: 6,500 근처에서 출렁임 → **3만 3천 이상 안정**
- Node 이벤트 루프 p95: 618ms → **6.75ms**
- CPU idle(2단계): 0% → **89%**

## 후일담: 설정이 조용히 사라졌다

두 달 뒤, 연결 수 급증을 조사하다가 우연히 발견했습니다.

- 호스트를 재부팅한 뒤 `somaxconn` 이 4096 으로 돌아가 있었습니다. `sysctl -w` 는 **런타임 설정이라 재부팅하면 사라지는데**, 영구 설정 파일을 만들어 두지 않았던 것입니다.
- nginx 의 `backlog=65535` 는 살아 있었지만 커널 상한 4096 에 잘려 실제로는 4096 이었습니다.
- 인프라를 재구성하면서 compose 파일 세트가 바뀌어, 컨테이너 sysctl 선언은 더 이상 쓰지 않는 옛 파일에만 남아 있었습니다.

무중단으로 할 수 있는 것부터 했습니다. 호스트 값은 `/etc/sysctl.d/` 파일로 영구화했습니다. 컨테이너 쪽 선언 복원은 3만 연결이 끊기는 작업이라 저부하 시간대로 미뤘습니다. 이미 bind 된 소켓의 backlog 는 listen 시점 값으로 고정되므로, 다음 재생성 때부터 적용됩니다.

## 배운 점

- **CPU 경보는 증상입니다.** 누가 CPU 를 쓰는지(`top`)부터 보고, 그 프로세스가 왜 바쁜지를 따라갑니다. 이번에는 nginx 가 실패한 연결을 처리하느라 바빴습니다.
- **지연이 높다고 앱 한계로 단정하지 않습니다.** 업스트림 I/O(포트, TIME_WAIT, accept 큐)를 먼저 배제합니다.
- **polling 에 갇힌 실시간 연결은 부하를 증폭시킵니다.** WebSocket 업그레이드 실패 원인은 아직 숙제로 남아 있습니다.
- **손으로 고친 설정은 선언(sysctl.d, compose, 코드)으로 남기지 않으면 반드시 사라집니다.** 사라지는 계기는 장애가 아니라 재부팅, 재구성 같은 평범한 운영 작업입니다.

## 진단 순서 (런북)

1. `top` — CPU 를 쓰는 프로세스가 누구인가
2. `ss -s`, `ss -lnt` — 연결 상태 분포와 listen 큐(Send-Q = backlog)
3. `nstat` 의 ListenOverflows/ListenDrops/SyncookiesSent, `dmesg` 의 SYN flooding
4. closed/TIME_WAIT 개수와 `ip_local_port_range` 비교
5. 그다음에 앱(Node) 상태
6. 경보 지표에 ListenOverflows 증가율과 임시 포트 사용률을 추가
