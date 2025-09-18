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
  "e2e" | "sttProc" | "txPipe" | "uiApply",
  { title: string; formula: string; desc: string; howToImprove: string }
> = {
  e2e: {
    title: "E2E 지연 (End-to-End)",
    formula: "T5 − T1",
    desc: "사용자 발화가 시작된 순간부터(UI 반영까지) 걸린 총 지연입니다. 사용자가 체감하는 전체 응답성을 직접적으로 나타냅니다.",
    howToImprove:
      "프레임 크기 축소, pace 재조정(realtime/fast), 큐 용량 조정 및 드롭 정책 최적화, 서버 스레드/RTF 개선, 네트워크 병목 제거."
  },
  sttProc: {
    title: "STT 처리 지연",
    formula: "T4 − T3",
    desc: "서버가 STT에 첫 전송을 시작한 뒤, 최종 결과를 수신할 때까지의 모델/서비스 처리 시간입니다.",
    howToImprove:
      "STT 설정(언어/표점/샘플레이트) 점검, 세그먼트 길이 최적화, 중복 전송/윈도우링 과다 제거, 서버 리소스/동시성 조정."
  },
  txPipe: {
    title: "전송 파이프라인 지연",
    formula: "T3 − T2",
    desc: "첫 프레임을 보낸 이후, 서버가 STT로 실제 전송을 시작하기까지의 지연입니다. 클라이언트→서버→STT 사이의 버퍼링/큐잉/스레딩 비용이 반영됩니다.",
    howToImprove:
      "WS 프레임 크기·전송 주기 조정, 서버 큐 정책(용량/드롭) 튜닝, 스레드 수 최적화, 불필요한 복사·직렬화 최소화."
  },
  uiApply: {
    title: "UI 반영 지연",
    formula: "T5 − T4",
    desc: "최종 텍스트를 받은 후 실제 화면에 표시되기까지의 지연입니다. 상태 업데이트, 렌더링, 포맷팅 비용이 포함됩니다.",
    howToImprove:
      "불필요한 re-render 방지(메모이제이션), 경량 포맷팅, 배치 업데이트, 가벼운 컴포넌트 트리 유지."
  }
};

export const SHORT_TIPS: Record<string, string> = {
  E2E: "전체 응답 시간(T5−T1). 사용자가 체감하는 총 지연.",
  STT: "모델 처리 시간(T4−T3). STT 서비스/모델 지연.",
  TX: "클→서→STT 시작까지(T3−T2). 큐·스레드·전송 병목 지표.",
  UI: "결과 수신→화면 표시(T5−T4). 렌더·상태 업데이트 비용."
};

