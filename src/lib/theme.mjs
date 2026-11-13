// Runs in <head> before first paint so the chosen look never flashes.
// astro.config.mjs adds this exact text's hash to the Content-Security-Policy, so keep it self-contained.
// Order of preference: ?theme=light|dark in the address, then the visitor's saved choice. Otherwise dark.
export const THEME_KEY = 'atv_theme';
export const THEME_COLORS = { light: '#fbfbfd', dark: '#05050d' };

export const THEME_SCRIPT = `(()=>{var t;try{t=new URLSearchParams(location.search).get('theme');if(t==='light'||t==='dark')localStorage.setItem('${THEME_KEY}',t);else t=localStorage.getItem('${THEME_KEY}')}catch(e){}if(t!=='light')t='dark';document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==='dark'?'${THEME_COLORS.dark}':'${THEME_COLORS.light}'})()`;
