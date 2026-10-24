# 피자마을 산책 — 2.5D 플레이 빌드

아이패드 미니에서 즐기는 가로형 2.5D 마을 모험 웹 게임입니다. 2D 도트 캐릭터가 입체적인 3D 마을을 걸어 다니며 요리·제작·직업 활동을 경험하는 것을 목표로 합니다.

## 현재 플레이 빌드

현재 빌드는 2D 캐릭터와 3D 배경의 결합감, 조작감, 화면 구성을 검증합니다.

- Three.js 기반 경량 3D 마을
- 4방향 2D 도트 캐릭터와 2프레임 걷기
- 카메라 추적, 충돌, 오브젝트 앞뒤 가림
- 아이패드용 왼쪽 조이스틱과 오른쪽 행동 버튼
- 피자가게 앞 광장 탐험
- 3D 문 열기와 실내광 반응
- 소리 설정을 기기별로 저장
- 홈 화면 웹 앱과 오프라인 재접속 기반

## 로컬 실행

Node.js가 설치된 Windows PC에서 처음 한 번 다음 명령을 실행합니다.

```powershell
npm install
```

그다음 `start-kids-games.cmd`를 실행하거나 다음 명령을 사용합니다.

```powershell
npm run dev
```

- 서버 PC: `http://127.0.0.1:8081/`
- 같은 Wi-Fi의 iPad: `http://서버PC의_IP:8081/`

## GitHub Pages

`main` 브랜치에 변경사항을 올리면 GitHub Actions가 게임을 빌드해 GitHub Pages에 배포합니다.

예상 주소: `https://j2y0206.github.io/games/`

저장소의 **Settings → Pages → Build and deployment → Source**에서 `GitHub Actions`를 한 번 선택해야 합니다.

## 프로젝트 구조

```text
index.html                         시작 화면과 터치 UI
src/main.js                        Three.js 월드, 도트 캐릭터, 이동과 상호작용
src/style.css                      아이패드 가로형 UI
public/                            PWA 매니페스트, 아이콘, 오프라인 캐시
.github/workflows/deploy-pages.yml GitHub Pages 자동 배포
docs/PRODUCT_PLAN.md               제품 방향과 단계별 목표
games/                             이전 조작 실험 보관
```

## 다음 단계

현재 2.5D 시각 방향을 두 아이패드에서 검증한 뒤 첫 완전한 미션을 구현합니다.

`주민 부탁 → 재료 찾기 → 피자 만들기 → 배달 → 꾸미기 보상`
