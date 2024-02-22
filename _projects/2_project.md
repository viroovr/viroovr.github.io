---
layout: page
title: DICOM 기반 동영상 Labeling 효율성 향상을 위한 방안 연구 및 구현
description: K-Software Empowerment Bootcamp Team "InsightMedi"
img: assets/img/2_dicom_project.png
importance: 2
category: work
---

1 . 연구목적

의료 및 헬스케어 분야의 전문가에게 시간적 자원의 가치는 높으므로, 최근 라벨링
과정에서 소요되는 많은 시간들을 줄이기 위한 연구 및 개발이 요구되고 있다.
InsightMedi는 이러한 문제 해결에 대한 필요성을 고려하여 기존의 방식보다 의료
전문가들이 훨씬 효율적으로 라벨링을 할 수 있도록 객체 추적 알고리즘을 사용하여
라벨 반자동화 기능을 제공하고 있으며, 기존 알고리즘의 성능을 높이고 세심한
라벨링 작업이 이루어질 수 있도록 라벨링 툴을 구현하는 것을 목표로 하였다.

2 . 내용

a. 의료 .mp4 영상과 DICOM 파일 뷰어 제작

- 의료 영상 분석에 필요한 영상 확대/축소 및 windowing 기능 등 다양한 기능들을 InsightMedi 뷰어에 통합하여 구현
- 뷰어에서 여러 도형들로 라벨 그리고, 라벨 선택·이동·삭제를 통해 라벨링 기능을 사용자가 쉽게 사용할 수 있도록 구현
- 그려진 라벨에 대한 데이터가 사용자의 PC 환경에 저장될 수 있도록 구현

b. opencv를 활용한 라벨 반자동화 기능 구현

- object tracking 알고리즘들을 이용하여 ROI를 선택하면, 라벨이 영상의 다음 frame에서 자동적으로 나타나도록 구현
- 이 외에 optical flow, grabcut 등을 활용하여 효율적인 라벨링을 지원하는 기능 연구

<div class="row mt-5">
    <div class="col-sm mt-5 mt-md-0">
        {% include figure.html path="assets/img/2_before.png" title="before object tracking" class="img-fluid rounded z-depth-1" %}
        그림 1. 객체 추적 초기 영상 이미지
    </div>
    <div class="col-sm mt-5 mt-md-0">
        {% include figure.html path="assets/img/2_after.png" title="after object tracking" class="img-fluid rounded z-depth-1" %}
        그림 2. 객체 추적 후 영상 이미지
    </div>
</div>

3 . 성과물(기대효과)

통합된 소프트웨어에서 의료 mp4 영상과 DICOM 파일을 다룰 수 있는 다양한 기능을 제공하여 의료 전문가들의 라벨링 속도 및 효율을 높일 수 있을 것으로 기대된다.
소프트웨어 내에서 다양하고 기능들을 주기적으로 업데이트를 진행함으로써 통합된 툴로써 편의성을 증진시킨다.

4 . 프로젝트 결과

최근 의료 산업계에서도 인공지능(AI), 딥러닝(deep learning) 연구가 진행되면서 연구 과정에서 필요한 학습 데이터에 대한 중요도 또한 크게 주목을 받고 있다. 그러나 딥러닝 모델의 학습에 필요한 충분한 양의 학습 데이터를 마련하기 위해서는 전체 연구 혹은 개발의 80%에 해당할 정도로 많은 시간과 인력을 소요하게 한다.

따라서 InsightMedi는 라벨링 과정이 보다 효율적이고, 빠르게 진행될 수 있도록 의료 전문가를 위한 의료 영상 전문 뷰어 기능과 라벨링 기능을 통합적으로 제공하고자 하였다. 일반적인 동영상 파일 형식(MP4) 외에도 국제의료영상표준(DICOM) 파일 형식을 처리할 수 있으며, DICOM 파일의 헤더에서 데이터를 읽어서 window level, window width 정보를 확인하고 조정하는 등을 기본적인 의료 영상 처리 및 분석을 할 수 있는 기능들을 구현하였다. 또한, 동영상에서 특정 조직이나 병변을 라벨링 할 때, CSRT 알고리즘과 이미지 유사도를 이용하여 object tracking한 결과로 라벨을 자동적으로 생성할 수 있는 기능을 추가하여 라벨링 과정에서 소요되는 많은 시간과 노력을 줄이고자 노력하였다.

InsightMedi에서 생성한 학습 데이터는 물체의 주요한 경계를 나타내고 있어서 주로 object detection이나 object localization과 같은 분야에서 사용될 수 있지만, 특정 픽셀의 영역을 라벨링 해야 하는 Image segmentation 분야의 학습 데이터는 생성하기가 어렵다는 한계점이 있다. 이 외에도 InsightMedi가 object tracking 과정에서 사용한 CSRT 알고리즘은 opencv API에 있는 다른 객체 추적 알고리즘들보다 성능은 좋지만, 객체 추적 속도가 느리다는 단점이 존재한다.

5 . 향후 계획

이러한 한계점을 고려하여 향후 InsightMedi의 업데이트에는 매 프레임마다 많은 계산량을 필요로 하여 속도가 느린 기존의 방식에 딥러닝 기반의 객체 추적 알고리즘을 혼용하여 성능을 개선을 위한
연구를 진행하고 구현하려 한다. 또한, 사용자의 편의성을 증진하기 위해서 주기적인 UI/UX 수정 및 기능 추가 등의 업데이트를 통해 지속적인 소프트웨어 유지 보수 및 관리에 신경을 쓸 계획이다.

6 . 시연 영상

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
    {% include video.html path="assets/video/A.mp4" class="img-fluid rounded z-depth-1" controls=true %}
    DICOM 파일의 라벨링 및 윈도윙 기능
    </div>
</div>

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
    {% include video.html path="assets/video/B.mp4" class="img-fluid rounded z-depth-1" controls=true %}
    의료 영상 반자동 객체 추적 기능
    </div>
</div>
