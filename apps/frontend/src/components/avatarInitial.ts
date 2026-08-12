/** 참가자 라벨에서 이니셜(아바타 한 글자)을 뽑는다. 마지막 단어의 첫 글자를 쓴다 —
 * "참가자 A" 같은 라벨은 전부 "참가자"로 시작해 앞글자로는 구분이 안 된다. 실제
 * 구분값은 뒤에 붙는 글자다. VotePanel의 투표 현황 그래프(zt-tally-label)도 같은
 * 규칙으로 참가자를 표시해야 해서 이 함수를 공유한다(8/11: 그래프 쪽이 이 로직 없이
 * 문자열 맨 앞글자만 잘라 써서 전원 "참"으로 보이는 버그가 있었다).
 *
 * Avatar.tsx가 아니라 별도 파일에 둔 이유: Avatar.tsx는 컴포넌트만 export해야
 * react-refresh(fast refresh)가 정상 동작한다 — 함수를 같이 export하면 eslint
 * react-refresh/only-export-components 규칙에 걸린다. */
export function avatarInitial(label: string): string {
  const tokens = label.trim().split(/\s+/);
  const lastToken = tokens[tokens.length - 1] ?? "";
  return lastToken.charAt(0) || "?";
}
