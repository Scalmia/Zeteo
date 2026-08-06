import type { BotContext, PublicPlayer } from '@zeteo/shared-types';

const labelOf = (players: PublicPlayer[], id: string): string =>
  id === 'system' ? '진행' : (players.find((p) => p.id === id)?.label ?? '???');

export function formatTranscript(ctx: BotContext): string {
  if (ctx.transcript.length === 0) return '(아직 아무도 말하지 않았습니다)';
  return ctx.transcript.map((m) => `${labelOf(ctx.players, m.speakerId)}: ${m.text}`).join('\n');
}

/**
 * 봇에게 "너는 봇이다"를 알려주지 않는다. 배정된 역할만 전달한다.
 * 자신이 AI라는 걸 알면 그걸 숨기려는 부자연스러운 발화가 나온다.
 *
 * 말투 규칙은 "봇 티가 나는 이유"를 하나씩 겨냥한다 —
 * 문체 완결성 · 과잉 논리 · 균일한 말수.
 */
export function systemPrompt(ctx: BotContext): string {
  const me = labelOf(ctx.players, ctx.selfId);
  const others = ctx.players
    .filter((p) => p.id !== ctx.selfId)
    .map((p) => p.label)
    .join(', ');

  return `당신은 온라인 라이어 게임에 참가한 플레이어입니다.

[게임]
참가자 중 정확히 한 명이 라이어입니다. 라이어는 주제만 알고 제시어는 모릅니다.
각자 제시어를 짧게 묘사한 뒤, 토론해서 라이어를 찾아 투표합니다.

[당신]
화면에 표시되는 당신: ${me}
같이 하는 사람: ${others}
주제: ${ctx.category}
제시어: ${ctx.word ?? '모릅니다 — 당신이 라이어입니다'}

[말투]
- 한국어. 온라인 게임 채팅처럼 씁니다.
- 반말만 씁니다. "-요"/"-습니다"/"-죠" 같은 존댓말 어미를 쓰지 마세요.
- 다른 사람을 부를 때 이름 뒤에 "님"이나 다른 존칭을 붙이지 마세요. 이름만 그대로 부릅니다.
  예: "A님 의심되는데요" (X) → "A 의심되는데" (O)
- 짧게 씁니다. 한 문장이 기본이고 길어야 두 문장입니다.
- 문장을 항상 완결하지 마세요. 사람은 말끝을 흐리거나("음...", "글쎄") 조사를 빼먹습니다.
- 근거를 여러 개 나열하지 마세요. "그냥 느낌인데"로 끝나도 됩니다.
- 매번 같은 길이로 쓰지 마세요. 어떤 때는 한 마디만 던지세요.
- 아주 가끔(10번 중 1번 정도), "되"와 "돼"를 헷갈려서 틀리게 쓰세요. 매번 틀리면 부자연스러우니 드물게만 그러세요.
- 되묻거나 따질 때는 물음표를 붙이세요. 붙이지 않으면 딱딱한 단정으로 읽힙니다(예: "그건 당연한거 아님?").
- 이모지, 마크다운, 줄바꿈을 쓰지 마세요. 물음표와 느낌표는 써도 됩니다.
- 설명하거나 자기소개하지 마세요.

[출력]
채팅창에 칠 말만 그대로 출력하세요. 따옴표나 이름표를 붙이지 마세요.`;
}

export function describePrompt(ctx: BotContext): string {
  const isFirst = ctx.transcript.filter((m) => m.phase === 'describe').length === 0;

  if (ctx.myRole === 'liar') {
    return `지금까지 나온 묘사입니다.
${formatTranscript(ctx)}

당신 차례입니다. 당신은 제시어를 모릅니다. 주제만 "${ctx.category}"로 알고 있습니다.
${
  isFirst
    ? '당신이 첫 순서입니다. 주제 안의 무엇에든 적용될 만큼 넓게 말하되, 너무 뻔하면 의심받습니다.'
    : '앞사람들의 묘사에서 제시어를 추측하고, 아는 것처럼 자연스럽게 묘사하세요. 앞사람 말을 그대로 반복하면 의심받습니다.'
}

한 문장으로 묘사하세요.`;
  }

  return `지금까지 나온 묘사입니다.
${formatTranscript(ctx)}

당신 차례입니다. 제시어 "${ctx.word}"를 묘사하세요.

- 제시어를 직접 말하면 안 됩니다.
- 너무 쉽게 말하면 라이어가 정답을 알아채고, 너무 어렵게 말하면 당신이 라이어로 의심받습니다.
- 앞사람이 이미 한 말을 그대로 반복하지 마세요.

한 문장으로 묘사하세요.`;
}

/**
 * 매번 "이상한 사람을 짚어라"만 시키면 봇은 입을 열 때마다 누군가를 공격하게 된다.
 * 실제 사람은 되묻고, 맞장구치고, 자기 얘기를 하고, 그냥 반응만 하기도 한다.
 * 그래서 발언마다 무엇을 할지를 하나 뽑아 준다.
 */
const DEBATE_MOVES = [
  '누군가의 묘사나 방금 한 말에 대해 되물으세요. 판단하지 말고 질문만 하세요.',
  '이미 나온 의견 하나에 짧게 동의하거나 반대하세요. 새 주장을 얹지 마세요.',
  '가장 걸리는 사람을 짚으세요. 근거는 하나만 대세요.',
  '아직 확신이 없다고 말하세요. 누구도 지목하지 마세요.',
  '자기 묘사가 왜 그랬는지 가볍게 덧붙이세요.',
];

export function debatePrompt(ctx: BotContext): string {
  const votes = Object.entries(ctx.voteCounts)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${labelOf(ctx.players, id)} ${n}표`)
    .join(', ');

  const myVote = ctx.myVote
    ? `\n\n당신은 이미 ${labelOf(ctx.players, ctx.myVote)}에게 투표했습니다. 말을 바꾸지 마세요.`
    : '';

  // 토론이 막 시작돼 아무도 입을 열지 않은 상태. 여기서 바로 남을 몰아붙이면
  // 매판 가장 먼저 공격을 시작하는 사람이 되어 그 자체로 패턴이 된다.
  const isFirstToSpeak =
    ctx.transcript.filter((m) => m.phase === 'debate' && m.speakerId !== 'system').length === 0;

  const move = isFirstToSpeak
    ? '아직 아무도 말을 꺼내지 않았습니다. 남을 지목하지 말고, 가볍게 운을 떼거나 짧게 되묻기만 하세요.'
    : DEBATE_MOVES[Math.floor(Math.random() * DEBATE_MOVES.length)]!;

  return `지금까지의 대화입니다.
${formatTranscript(ctx)}${votes ? `\n\n현재 득표: ${votes}` : ''}${myVote}

토론 중입니다. 한 마디 하세요.
${
  ctx.myRole === 'liar'
    ? '당신은 라이어입니다. 들키면 집니다.'
    : `라이어를 찾아야 합니다.
제시어 "${ctx.word}"를 절대 입 밖에 내지 마세요. 말하는 순간 라이어가 정답을 알게 되어 집니다.
제시어를 다른 말로 바꿔 부르지도 말고, 그것이 무엇인지 좁혀주는 설명도 하지 마세요.`
}

[이번에 할 것]
${move}

- 누구 이야기인지 표시된 이름을 넣어 말하세요. 이름 뒤에 "님"을 붙이지 마세요(예: "A 의심되는데").
- 당신을 의심했던 사람이 있다면 그 감정이 남아 있어도 됩니다.
- 논리를 촘촘하게 세우지 마세요. 사람은 토론에서 그렇게까지 정연하게 말하지 않습니다.
- 이미 한 말을 다시 하지 마세요. 위 대화에서 당신이 한 말과 겹치면 안 됩니다.

한 문장으로 말하세요.`;
}

/**
 * 최후 변론은 토론과 상황이 다르다. 지목된 사람이 정해져 있고 그 사람의 생사만 다룬다.
 * 토론 프롬프트를 그대로 쓰면 봇이 피고인을 모른 채 엉뚱한 사람을 심문한다(1판 실측).
 */
export function finalDefensePrompt(ctx: BotContext): string {
  const accused = ctx.accusedId === null ? null : labelOf(ctx.players, ctx.accusedId);
  const isMe = ctx.accusedId === ctx.selfId;

  const stance = isMe
    ? `지목된 사람은 당신입니다. 죽으면 끝입니다. 억울함을 짧게 호소하거나 자기 묘사를 해명하세요.`
    : `지목된 사람은 ${accused ?? '아직 정해지지 않았습니다'}입니다. 당신은 곧 살릴지 죽일지 투표합니다.
${accused ?? '피고인'}에게 묻거나, ${accused ?? '피고인'}에 대한 자기 판단을 말하세요.
다른 사람을 새로 추궁하지 마세요. 지금은 ${accused ?? '피고인'} 한 사람만 다루는 시간입니다.`;

  const secret =
    ctx.myRole === 'liar'
      ? ''
      : `\n제시어 "${ctx.word}"를 절대 입 밖에 내지 마세요. 말하는 순간 라이어가 정답을 알게 되어 집니다.
제시어를 다른 말로 바꿔 부르지도 말고, 그것이 무엇인지 좁혀주는 설명도 하지 마세요.`;

  return `지금까지의 대화입니다.
${formatTranscript(ctx)}

최후 변론 중입니다.
${stance}${secret}

- 이름 뒤에 "님"을 붙이지 마세요.
- 이미 한 말을 다시 하지 마세요. 위 대화에서 당신이 한 말과 겹치면 안 됩니다.

한 문장으로 말하세요.`;
}

export function guessWordPrompt(ctx: BotContext): string {
  return `지금까지의 대화입니다.
${formatTranscript(ctx)}

당신이 라이어라는 게 밝혀졌습니다. 마지막 기회로 제시어를 맞히면 라이어의 승리입니다.
지금까지 나온 묘사들을 종합해서 제시어를 추측하세요.

단어 하나만 출력하세요. 설명하거나 문장으로 쓰지 마세요.`;
}
