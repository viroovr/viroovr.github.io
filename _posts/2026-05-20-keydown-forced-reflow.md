---
layout: post
title: "키 하나에 19ms — 입력 지연을 만든 범인은 애니메이션이 아니라 :visible 이었다"
date: 2026-05-20 21:00:00+0900
description: Performance 트레이스를 이벤트 구간 단위로 쪼개 보고, jQuery :visible 이 만든 강제 리플로우를 찾아낸 과정
tags: troubleshooting performance frontend
categories: blog
---

## 증상

macOS 의 데스크톱 앱(Electron 22, Chromium 108)과 Safari 에서 게시물 제목, 하위업무, 할일을 입력하면 **글자가 늦게 따라온다**는 보고가 들어왔습니다. Windows 에서는 같은 보고가 거의 없었습니다.

## 관측 사실

보고자 환경에서 DevTools Performance 트레이스(약 30초)를 받아 keydown 이벤트만 골라 봤습니다.

- **영문** 입력의 keydown 처리 시간은 일관되게 **약 19ms**(18.9~20.0ms)였습니다.
- **한글** 입력은 1ms 미만이었습니다. IME 조합 중에는 `isComposing` 가드가 핸들러를 일찍 끝내기 때문입니다. 영문은 핸들러 전체를 탔습니다.
- 19.96ms 짜리 keydown 하나를 쪼개 보면:
  - jQuery 이벤트 핸들러 자체: 1.18ms
  - 그 직후 **UpdateLayoutTree: 17.78ms**. 이 구간 샘플 137개가 전부 네이티브 스타일/레이아웃 계산이었습니다.

60fps 한 프레임이 16.7ms 이니, 키를 누를 때마다 레이아웃 계산이 한 프레임을 통째로 먹고 있었습니다.

## 첫 번째 가설: 배경 애니메이션 (반만 맞았다)

같은 트레이스 전체의 CPU 샘플을 보면 **lottie 애니메이션의 `advanceTime` 이 48.5%** 로 압도적이었습니다. 화면 뒤쪽에서 lottie 13개가 계속 돌고 있었습니다.

그래서 1차로 "작성 팝업이 열리면 배경 lottie 를 멈춘다"를 넣었습니다. 여기서 두 번 틀렸습니다.

1. 처음엔 `pause()` 만 호출했는데 효과가 없었습니다(35.29 → 38.16ms). 멈춘 SVG 도 **레이아웃 트리에는 그대로 남아** 있기 때문입니다. `display: none` 으로 레이아웃에서 빼야 했습니다.
2. 처음 훅을 건 초기화 함수는 **외부에서 아무도 호출하지 않는 함수**였습니다. 수정이 아예 실행되지 않았습니다. 실제로 호출되는 함수로 옮겼습니다.

```js
// 작성 팝업이 열릴 때 배경 lottie 를 레이아웃에서 제외
function pauseAll() {
  document.querySelectorAll('dotlottie-player').forEach((el) => {
    if (paused.has(el)) return;
    el.pause();
    paused.set(el, el.style.display);   // 원래 display 보존
    el.style.display = 'none';
  });
}
// 팝업이 닫힐 때 resumeAll() 로 복원
```

lottie 13개를 강제로 띄운 시뮬레이션에서는 42.59ms → 9.43ms(−78%)로 크게 줄었습니다. 그런데 **p95 는 그대로**였습니다.

결정적인 단서는 제 PC 의 트레이스였습니다. lottie 가 0개인 환경에서도 keydown 최대 15.2ms 중 13.98ms 가 UpdateLayoutTree 였습니다. **lottie 와 별개인 레이아웃 비용이 따로 있었던 것**입니다. "전체 CPU 의 top 함수"와 "keydown 구간 안의 비용"은 다른 이야기였습니다.

## 진짜 원인: 매 키마다 :visible 두 번

keydown 구간의 hot frame 에 `jQuery.expr.pseudos.visible` 이 반복해서 보였습니다. 코드를 찾아보니 키를 누를 때마다 실행되는 핸들러가 이런 확인을 하고 있었습니다.

```js
if ($popup.find('#hashTagPopup').is(':visible')) { ... }
if ($popup.find('#mentionPopup').is(':visible')) { ... }
```

jQuery 의 `:visible` 은 내부적으로 `offsetWidth`, `offsetHeight`, `getClientRects()` 를 읽습니다. 모두 **레이아웃 값을 읽는 API** 입니다.

문제는 순서입니다. 같은 keydown 처리 안에서 앞쪽 코드가 이미 DOM 을 바꿔 놓았습니다(입력 내용 변경, 스타일 처리). 그 직후에 레이아웃 값을 읽으면, 브라우저는 정확한 값을 주려고 **스타일과 레이아웃을 그 자리에서 동기로 다시 계산**합니다. 이것이 강제 리플로우(forced reflow), 즉 "쓰고 나서 바로 읽기" 패턴입니다. DOM 노드가 약 1.4만 개인 화면이라 한 번 계산이 비쌌습니다.

## 수정 방향 고르기

- **A. 표시 상태를 플래그로 관리한다.** 효과는 가장 크지만, 팝업을 여닫는 진입점을 하나라도 놓치면 회귀가 납니다.
- **B. `style.display` 를 직접 읽는다.** 인라인 스타일만 보므로 레이아웃 계산이 필요 없습니다. 바뀌는 줄은 2줄입니다.
- **C. CSS `contain` 으로 레이아웃 범위를 가둔다.** 효과가 불확실하고 절대 위치 자식이 깨질 수 있습니다.
- **D. 결과를 캐시한다.** 첫 읽기의 리플로우는 남습니다.

B 를 먼저 적용하기로 했습니다. 그 전에 두 팝업의 표시/숨김이 **모두 인라인 `display: block/none` 으로만** 바뀐다는 것을 grep 으로 확인했습니다. CSS 클래스로 숨기는 경로가 있으면 B 는 틀린 답을 냅니다.

```js
// before: $popup.find('#hashTagPopup').is(':visible')
const el = $popup.find('#hashTagPopup')[0];
if (el && el.style.display !== 'none') { ... }   // 멘션 팝업도 동일
```

## 검증

- 수정 후 트레이스에서 `:visible` hot frame 이 사라졌습니다.
- 해시태그·멘션 팝업의 방향키/Enter 동작과 일반 입력을 수동으로 확인했습니다.
- 다만 제 환경에서는 원래 지연이 작아서, 수치 차이가 측정 변동에 묻혔습니다. keydown 이후 다음 프레임까지 걸린 시간은 vsync 를 맞추면 약 2ms, 놓치면 약 14ms 로 갈렸습니다. 이런 이봉 분포라 1~2ms 개선은 구분이 안 됐습니다.
- **보고자 환경에서 수정 후 트레이스를 다시 받지 못해**, 이 건은 "부분 해결"로 닫았습니다. 같은 `:visible` 패턴이 약 12곳 더 남아 후속 작업으로 넘겼습니다.

## 배운 점

- **CPU 프로파일의 1등 함수가 곧 지연의 원인은 아닙니다.** 전체 평균이 아니라 문제 이벤트 구간만 잘라서 봐야 합니다. 이 가정 때문에 틀린 결론을 여러 번 냈습니다.
- **레이아웃을 읽는 API 목록을 외워 둡니다.** `offsetWidth/Height`, `getBoundingClientRect`, `getClientRects`, `getComputedStyle`, 그리고 이것들을 감싼 jQuery 의 `:visible`, `.offset()`, `.height()`.
- **`pause()` 는 레이아웃 비용을 없애지 않습니다.** 레이아웃에서 빼려면 `display: none` 입니다.
- **수정을 걸 함수의 호출자를 먼저 확인합니다.** 아무도 부르지 않는 함수에 건 수정은 실행되지 않습니다.
- **측정 단위를 항상 밝힙니다.** "이벤트 처리 시간"과 "다음 프레임까지 시간"은 다른 숫자입니다. 뒤쪽에는 vsync 대기가 섞입니다.
- 측정 코드도 조심합니다. 측정 리스너 안에서 `offsetHeight` 를 읽었더니 **측정 코드가 13ms 지연을 만들고** 있었습니다.
- 환경에 따라 다른 결함이면, 가설을 쌓기 전에 보고자 환경에서 트레이스부터 받습니다.
