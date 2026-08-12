/** 파트 D 소유 — 박진. Blood Moon 장식 레이어(달빛·피 방울·노이즈). 클릭에 관여하지 않는다. */
export function Ambience() {
  return (
    <>
      <div className="moonlight" aria-hidden="true" />
      <div className="blood-drops" aria-hidden="true">
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
      </div>
      <svg className="ambience-noise" aria-hidden="true">
        <filter id="zt-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" />
          <feBlend in="SourceGraphic" in2="noise" mode="multiply" result="blend" />
          <feComposite in="blend" in2="SourceAlpha" operator="in" />
        </filter>
      </svg>
    </>
  );
}
