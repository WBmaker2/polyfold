import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import { App } from './app/App';

const root = document.getElementById('app');

if (!root) {
  throw new Error('PolyFold: #app 컨테이너를 찾을 수 없어요.');
}

try {
  new App(root);
} catch (error) {
  console.error(error);
  root.innerHTML = `
    <div style="max-width:560px;margin:12vh auto;padding:32px;font-family:system-ui,sans-serif;line-height:1.6">
      <h1 style="font-size:24px;margin-bottom:12px">PolyFold를 시작하지 못했어요</h1>
      <p>WebGL을 지원하는 최신 브라우저에서 다시 열어 주세요. 문제가 계속되면 새로고침해 보세요.</p>
    </div>
  `;
}

if (import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      console.warn('PolyFold: 오프라인 캐시를 준비하지 못했어요.');
    });
}
