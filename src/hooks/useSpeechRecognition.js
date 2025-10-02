import { useEffect, useRef } from 'react';

export default function useSpeechRecognition({
  activeQId,
  setActiveQId,
  questions,
  setHistory,
  recordState,
  setRecordState,
  currentAnswer,
  setCurrentAnswer,
  interimText,
  setInterimText,
  autoSilenceMs = 5000,
  autoSilenceMode = 'pause',
  bumpSilenceTimer,
  clearSilenceTimer,
}) {
  const recogRef = useRef(null);
  const OTHER_ID = 'OTHER_ID_CONST';

  // 直近の状態と対象QIDを参照するためのref（onresult内レース防止）
  const stateRef = useRef(recordState);
  const activeQIdRef = useRef(activeQId);
  useEffect(() => { stateRef.current = recordState; }, [recordState]);
  useEffect(() => { activeQIdRef.current = activeQId; }, [activeQId]);

  function ensureRecognizer(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ return null; }
    if(recogRef.current){ return recogRef.current; }
    const r = new SR();
    r.lang = 'ja-JP';
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => {
      // 停止中や対象外QIDのイベントは破棄
      if (stateRef.current !== 'recording') return;

      let interim = '';
      let finalChunk = '';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const res = e.results[i];
        const text = res[0]?.transcript || '';
        if(res.isFinal) finalChunk += text;
        else interim += text;
      }
      if(interim) setInterimText(interim);
      if(finalChunk) {
        setCurrentAnswer(prev => (prev ? prev + finalChunk : finalChunk));
        setInterimText('');
        bumpSilenceTimer();
      }
    };
    r.onerror = () => {
      setRecordState('idle');
      try { r.stop(); } catch {}
    };
    r.onend = () => {
      if(recordState === 'recording') {
        try { r.start(); } catch {}
      }
    };
    recogRef.current = r;
    return r;
  }

  function startRecordingFor(qid){
    const r = ensureRecognizer();
    if(!r){ return; }
    try { r.start(); } catch {}
    setRecordState('recording');
    bumpSilenceTimer();
  }
  function pauseOrEnd(){
    const r = recogRef.current;
    if(!r){ return; }
    try { r.stop(); } catch {}
    setRecordState('paused');
    clearSilenceTimer();
  }
  function stopNow(){
    const r = recogRef.current;
    if(!r){ return; }
    try { r.stop(); } catch {}
    setRecordState('idle');
    clearSilenceTimer();
  }
  function finalizeCurrent(){
    // 呼び出し側で履歴追加
    stopNow();
  }
  function finalizeAsOther(){
    stopNow();
  }
  function startRecordingOther(){
    startRecordingFor(OTHER_ID);
  }
  function hardStopAndQuarantine(){
    stopNow();
    setInterimText('');
  }
  // クリック切替前に必ず呼ぶバッファ初期化
  function resetBuffers(){
    setCurrentAnswer('');
    setInterimText('');
  }

  useEffect(()=>()=>{
    try { recogRef.current?.abort?.(); } catch {}
  },[]);

  return {
    recogRef,
    ensureRecognizer,
    startRecordingFor,
    startRecordingOther,
    pauseOrEnd,
    stopNow,
    finalizeCurrent,
    finalizeAsOther,
    OTHER_ID,
    hardStopAndQuarantine,
    resetBuffers,
  };
}