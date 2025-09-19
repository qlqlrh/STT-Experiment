export const TIMESTAMP_DESCRIPTIONS: Record<string, { title: string; desc: string }> = {
  T1: {
    title: "T1 — 세그먼트 수집 시작",
    desc: "브라우저가 해당 발화(세그먼트)를 캡처하기 시작한 시각입니다. performance.now() 기반 모노토닉 타임."
  },
  T2: {
    title: "T2 — 첫 오디오 프레임 전송",
    desc: "해당 세그먼트의 첫 PCM 프레임을 WebSocket으로 전송한 시각입니다. 네트워크 및 프론트 패킹 지연의 하한선을 반영."
  },
  T3: {
    title: "T3 — 서버 첫 STT 전송",
    desc: "백엔드가 구글 STT 스트리밍에 오디오를 ‘처음’ 밀어 넣은 시각입니다. 서버 큐/스레드/전송 경로의 지연을 포함."
  },
  T4: {
    title: "T4 — STT 최종 결과 수신",
    desc: "구글 STT로부터 해당 세그먼트의 최종(final) 인식 결과를 받은 시각입니다. 모델 처리 시간과 네트워크 왕복이 반영."
  },
  T5: {
    title: "T5 — UI 반영 완료",
    desc: "최종 텍스트를 화면에 렌더링 완료한 시각입니다. 클라이언트 상태 업데이트·렌더 비용을 포함."
  }
};

export const METRIC_DESCRIPTIONS: Record<
  never,
  { title: string; formula: string; desc: string; howToImprove: string }
> = {} as any;

export const SHORT_TIPS: Record<string, string> = {
  // Legacy tips removed; ASL/ASL%만 사용
};

