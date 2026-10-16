# 아이들 직업 역할놀이

2021·2022년생 아이들이 iPad에서 설명 없이 바로 만져 볼 수 있는 가로형 웹 역할놀이 프로젝트입니다.

## 첫 번째 시제품: 꼬마 자동차 정비소

자동차에 묻은 진흙을 호스나 스펀지를 직접 끌어서 닦습니다.

- 글자 읽기, 점수, 제한 시간, 실패 없음
- 한 화면에서 바로 시작
- 손가락으로 도구를 잡고 자동차에 문지르는 직접 조작
- 자동차를 모두 닦으면 새 자동차가 들어와 반복 가능
- 외부 이미지나 인터넷 연결 없이 실행

## 실행

Windows에서 `start-kids-games.cmd`를 실행합니다.

- 서버 PC: `http://127.0.0.1:8081/games/tiny-garage/`
- 같은 Wi-Fi의 iPad: `http://서버PC의_IP:8081/games/tiny-garage/`

서버 PC의 IP는 명령 프롬프트에서 `ipconfig`를 실행하고 현재 사용 중인 네트워크 어댑터의 IPv4 주소를 확인합니다. Windows 방화벽 메시지가 뜨면 개인 네트워크 접근만 허용합니다.

## 두 PC에서 이어서 작업하기

처음 한 번은 집 PC에서 개인 Git 저장소를 복제합니다. 이후 작업을 시작하기 전에 `git pull`, 작업을 마친 뒤에는 `git add`, `git commit`, `git push` 순서로 동기화합니다.

## 구조

```text
games/tiny-garage/index.html   화면과 자동차 SVG
games/tiny-garage/styles.css  가로형 레이아웃과 만화풍 그래픽
games/tiny-garage/game.js     터치·세척·다음 자동차 동작
start-kids-games.cmd          가정용 LAN 서버 실행
```
