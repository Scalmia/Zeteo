/** 파트 D 소유 — 박진. Blood Moon 장식 레이어(피 방울). 클릭에 관여하지 않는다. */
export function Ambience() {
  return (
    <>
      {/* 정확히 12개다 — ambience.css의 .blood-drop:nth-child(1)~(12)가 각자
          다른 위치(left)·낙하 속도(animation-delay/duration)를 하나씩 지정한다.
          늘리거나 줄이면 스타일 없는 방울이 생기거나 안 쓰는 CSS 규칙이 남는다. */}
      <div className="blood-drops" aria-hidden="true">
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
        <div className="blood-drop" />
      </div>
    </>
  );
}
