import React, { useEffect, useMemo, useRef, useState } from "react";
import ShortcutHelpModal from "./components/ShortcutHelpModal.jsx";
import StatusDot from "./components/StatusDot.jsx";
import useSpeechRecognition from "./hooks/useSpeechRecognition.js";
import { parseFile } from "./utils/importers.js";
import { downloadCSV, downloadJSON, downloadXLSX } from "./utils/exporters.js";

// 定数
const STORAGE_KEY = "support_assistant_state_v1";
const OTHER_ID = "OTHER_ID_CONST";
const BADGE_EMERALD = "bg-emerald-100 text-emerald-700 border-emerald-300";
const BADGE_AMBER = "bg-amber-100 text-amber-700 border-amber-300";
const BTN_PRIMARY =
  "px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50";
const BTN_SOFT =
  "px-3 py-2 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-50";
const INPUT =
  "px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white";
const TAB_BTN = "px-3 py-1.5 rounded-full border";
const TAB_ACTIVE = "bg-slate-900 text-white border-slate-900";
const TAB_IDLE = "bg-white text-slate-700 border-slate-300 hover:bg-slate-100";
// 新しいボタン定数を定義
const BTN_IMPORT =
  "px-3 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50";
const BTN_EXPORT =
  "px-3 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-opacity-50";
const BTN_DELETE =
  "px-3 py-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-opacity-50";
// 新しいボタン定数を定義
const BTN_OTHER =
  "px-3 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-opacity-50";

// サイレンスタイマー（無効化したい場合は 0、延長は任意ミリ秒）
const AUTO_SILENCE_MS = 60000; // 0 = 無効
const AUTO_SILENCE_MODE = "pause"; // 停止なら'pause' から 'none' に

function slug(s) {
  const ascii = s
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 40);
  if (ascii) return ascii;
  // 非ASCIIのみの場合は安定ハッシュでID化
  let h = 0 >>> 0;
  for (const ch of s) h = (h * 31 + (ch.codePointAt(0) || 0)) >>> 0;
  return "t_" + h.toString(36).slice(0, 12);
}

function uid() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function now() {
  return Date.now();
}

export default function SupportAssistantApp() {
  // 状態
  const [categories, setCategories] = useState([]); // 空配列で開始
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // id -> [{id,text,createdAt}]
  const [activeCategoryId, setActiveCategoryId] = useState("all_cats"); // デフォルトをすべてのカテゴリに
  const [activeTab, setActiveTab] = useState("unanswered"); // 'unanswered'|'answered'
  const [activeQId, setActiveQId] = useState(null);
  const [query, setQuery] = useState("");
  const [interimText, setInterimText] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [recordState, setRecordState] = useState("idle"); // idle|recording|paused
  const [helpOpen, setHelpOpen] = useState(false);
  const silenceTimerRef = useRef(null);

  // 回答履歴のカテゴリを管理する新しい状態を追加
  const [activeHistoryCategoryId, setActiveHistoryCategoryId] =
    useState("all_cats");

  // 永続化ロード
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setCategories(s.categories?.length ? s.categories : []); // 空配列で開始
        setQuestions(Array.isArray(s.questions) ? s.questions : []);
        setAnswers(s.answers || {});
        setActiveCategoryId(s.activeCategoryId || "all_cats");
        setActiveTab(s.activeTab === "answered" ? "answered" : "unanswered");
        // activeHistoryCategoryId を永続化からロード
        setActiveHistoryCategoryId(s.activeHistoryCategoryId || "all_cats");
      }
    } catch {
      // 破損時は初期化
      setCategories([]);
      setQuestions([]);
      setAnswers({});
      setActiveCategoryId("all_cats");
      setActiveTab("unanswered");
      setActiveHistoryCategoryId("all_cats"); // 初期化時にも設定
    }
  }, []);
  // 永続化セーブ
  useEffect(() => {
    const s = {
      categories,
      questions,
      answers,
      activeCategoryId,
      activeTab,
      activeHistoryCategoryId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }, [
    categories,
    questions,
    answers,
    activeCategoryId,
    activeTab,
    activeHistoryCategoryId,
  ]); // 新しい状態を依存配列に追加

  // サイレンスタイマー
  const bumpSilenceTimer = () => {
    clearTimeout(silenceTimerRef.current);
    if (AUTO_SILENCE_MS > 0 && AUTO_SILENCE_MODE === "pause") {
      silenceTimerRef.current = setTimeout(() => {
        if (recordState === "recording") {
          setRecordState("paused");
        }
      }, AUTO_SILENCE_MS);
    }
  };
  const clearSilenceTimer = () => {
    clearTimeout(silenceTimerRef.current);
  };

  const speech = useSpeechRecognition({
    activeQId,
    setActiveQId,
    questions,
    setHistory: setAnswers,
    recordState,
    setRecordState,
    currentAnswer,
    setCurrentAnswer,
    interimText,
    setInterimText,
    autoSilenceMs: AUTO_SILENCE_MS,
    autoSilenceMode: AUTO_SILENCE_MODE,
    bumpSilenceTimer,
    clearSilenceTimer,
  });

  const activeQuestion = useMemo(
    () => questions.find((q) => q.id === activeQId) || null,
    [questions, activeQId]
  );

  // 編集中の回答の状態
  const [editingAnswerId, setEditingAnswerId] = useState(null); // qid-aid の形式
  const [editingAnswerText, setEditingAnswerText] = useState("");

  // 連続Enterキー入力のタイムスタンプを管理するref
  const lastEnterTimeRef = useRef(0);

  // 回答の編集を開始
  const handleEditAnswerClick = (qid, aid, currentText) => {
    setEditingAnswerId(`${qid}-${aid}`);
    setEditingAnswerText(currentText);
  };

  // 編集した回答を保存
  const handleSaveEditedAnswer = (qid, aid) => {
    setAnswers((prevAnswers) => {
      const updatedAnswers = { ...prevAnswers };
      if (updatedAnswers[qid]) {
        updatedAnswers[qid] = updatedAnswers[qid].map((a) =>
          a.id === aid ? { ...a, text: editingAnswerText, createdAt: now() } : a
        );
      }
      return updatedAnswers;
    });
    setEditingAnswerId(null);
    setEditingAnswerText("");
    toast("回答を更新しました", "ok");
  };

  // 回答の編集をキャンセル
  const handleCancelEdit = () => {
    setEditingAnswerId(null);
    setEditingAnswerText("");
  };

  // 回答の削除
  const handleDeleteAnswer = (qid, aid) => {
    if (!confirm("この回答を削除しますか？")) return;
    setAnswers((prevAnswers) => {
      const updatedAnswers = { ...prevAnswers };
      if (updatedAnswers[qid]) {
        updatedAnswers[qid] = updatedAnswers[qid].filter((a) => a.id !== aid);
        if (updatedAnswers[qid].length === 0) {
          // その質問の回答がなくなったら、質問を未回答に戻す
          setQuestions((prevQuestions) =>
            prevQuestions.map((q) => (q.id === qid ? { ...q, done: false } : q))
          );
          delete updatedAnswers[qid]; // 回答がない質問は answers から削除
        }
      }
      return updatedAnswers;
    });
    toast("回答を削除しました", "ok");
  };

  // フィルタされた質問
  const filteredQuestions = useMemo(() => {
    console.log("Filtering questions:", {
      activeCategoryId,
      totalQuestions: questions.length,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
    });

    const inCat =
      activeCategoryId === "all_cats"
        ? questions
        : questions.filter((q) => {
            const matches = q.categoryId === activeCategoryId;
            console.log(
              `Question "${q.text}" categoryId: ${q.categoryId}, activeCategoryId: ${activeCategoryId}, matches: ${matches}`
            );
            return matches;
          });

    console.log("Filtered by category:", inCat.length);

    const byTab =
      activeTab === "unanswered"
        ? inCat.filter((q) => !q.done)
        : activeTab === "answered"
        ? inCat.filter((q) => q.done)
        : inCat;
    const q = query.trim().toLowerCase();
    const byQuery = q
      ? byTab.filter((v) => v.text.toLowerCase().includes(q))
      : byTab;
    // OTHER は先頭に（作成用）
    return byQuery;
  }, [questions, activeCategoryId, activeTab, query]);

  // ヘルパ：カテゴリタブ一覧（先頭に「すべてのカテゴリ」）
  const tabCategories = useMemo(() => {
    const rest = [...categories].sort((a, b) => a.order - b.order);
    return [{ id: "all_cats", name: "すべてのカテゴリ" }, ...rest];
  }, [categories]);

  // 次録音の安全開始（停止→待機→開始、最大3回リトライ）
  function startRecordingWithRetry(qid, asOther = false, attempt = 1) {
    const start = () => {
      try {
        if (asOther) {
          speech.startRecordingOther();
        } else {
          speech.startRecordingFor(qid);
        }
      } catch {
        if (attempt < 3) {
          setTimeout(
            () => startRecordingWithRetry(qid, asOther, attempt + 1),
            250
          );
        }
      }
    };
    setTimeout(start, 180); // stop直後のクールダウン
  }

  // 質問クリック時の録音ガード
  const handleQuestionClick = (qid) => {
    const isSameQuestion = activeQId === qid;
    const hasText = (currentAnswer || "").trim() || (interimText || "").trim();

    if (isSameQuestion) {
      const question = questions.find((q) => q.id === qid);
      if (question && question.done) {
        // 回答済みの場合、音声入力があれば記録し、録音を停止。なければ停止のみ。
        if (hasText) {
          confirmAnswer(); // これで保存され、currentAnswer/interimTextはクリアされる
        }
        speech.stopNow(); // 録音を完全に停止
      } else {
        // 未回答の場合、キャンセル
        cancelAnswer();
      }
    }

    // 別の質問への切り替えロジック
    if (recordState === "recording" || recordState === "paused") {
      if (activeQId && activeQId !== qid && hasText) {
        // 別の質問に切り替えて、かつ音声入力がある場合
        confirmAnswer();
      } else {
        speech.hardStopAndQuarantine();
      }
    } else {
      speech.stopNow();
    }

    // 次の録音を始める前に必ずバッファを空にする（レース防止）
    speech.resetBuffers();

    setActiveQId(qid);

    // 停止→待機→開始（レース回避＋リトライ）
    startRecordingWithRetry(qid, qid === OTHER_ID);
  };

  // 確定処理（currentAnswer または interim）
  const confirmAnswer = () => {
    // currentAnswer と interimText の現在の値を結合して確定テキストを生成
    let finalizedText = (currentAnswer || "").trim();
    if ((interimText || "").trim()) {
      // currentAnswer が既に存在する場合、スペースを追加してinterimTextを結合
      finalizedText += (finalizedText ? " " : "") + interimText.trim();
    }

    if (!finalizedText) {
      // テキストが空の場合は何もしない
      return;
    }

    if (activeQId === OTHER_ID) {
      // OTHER → 通常質問へ変換
      // 現在選択されているカテゴリを取得（all_catsの場合は最初のカテゴリを使用）
      let targetCategoryId = activeCategoryId;
      if (activeCategoryId === "all_cats") {
        // すべてのカテゴリが選択されている場合は、最初のカテゴリを使用
        targetCategoryId = categories.length > 0 ? categories[0].id : "未分類";
      }

      const newQ = {
        id: uid(),
        text: finalizedText.slice(0, 2000), // finalizedText を使用
        createdAt: now(),
        done: true,
        categoryId: targetCategoryId,
      };
      setQuestions((prev) => [...prev, newQ]);
      setAnswers((prev) => ({
        ...prev,
        [newQ.id]: [
          {
            id: uid(),
            text: finalizedText, // finalizedText を使用
            createdAt: now(),
            meta: {
              categoryId: targetCategoryId,
              isFromOther: true,
            },
          },
        ],
      }));
      setActiveQId(newQ.id);
    } else if (activeQuestion) {
      setAnswers((prev) => {
        const arr = prev[activeQuestion.id] ? [...prev[activeQuestion.id]] : [];
        arr.unshift({
          id: uid(),
          text: finalizedText, // finalizedText を使用
          createdAt: now(),
          meta: { categoryId: activeQuestion.categoryId },
        });
        return { ...prev, [activeQuestion.id]: arr };
      });
      setQuestions((prev) =>
        prev.map((q) => (q.id === activeQuestion.id ? { ...q, done: true } : q))
      );
    }
    setCurrentAnswer("");
    setInterimText("");
    speech.finalizeCurrent(); // 確定処理の最後に呼び出す

    // 回答が記録されたカテゴリに、回答履歴タブを切り替える
    if (activeQId === OTHER_ID) {
      // 新規質問からの場合は、新しく作成された質問のカテゴリに切り替える
      let targetCategoryId = activeCategoryId;
      if (activeCategoryId === "all_cats") {
        targetCategoryId = categories.length > 0 ? categories[0].id : "未分類";
      }
      setActiveHistoryCategoryId(targetCategoryId);
    } else if (activeQuestion) {
      setActiveHistoryCategoryId(activeQuestion.categoryId);
    }
  };

  // 取消
  const cancelAnswer = () => {
    setCurrentAnswer("");
    setInterimText("");
    speech.stopNow();
  };

  // 新規質問（OTHER で開始）
  const createOther = () => {
    if (recordState === "recording" || recordState === "paused") {
      speech.hardStopAndQuarantine();
    }
    setActiveQId(OTHER_ID);
    setCurrentAnswer("");
    setInterimText("");
    // 新規質問（OTHER）が押されたときに録音を開始
    startRecordingWithRetry(OTHER_ID, true);
  };

  // インポート
  const fileInputRef = useRef(null);
  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await parseFile(file); // {tab,text,id?,createdAt?}[]
      console.log("Parsed file data:", raw);

      // 正規化＆マージ
      const existingSet = new Set(
        questions.map(
          (q) =>
            `${(
              categories.find((c) => c.id === q.categoryId)?.name || "未分類"
            ).toLowerCase()}||${q.text.toLowerCase()}`
        )
      );
      const newCats = new Map(categories.map((c) => [c.name, c]));
      const toAddQs = [];
      for (const r of raw) {
        const tab = (r.tab || "未分類").toString().trim() || "未分類";
        const text = r.text.toString().trim();
        const key = `${tab.toLowerCase()}||${text.toLowerCase()}`;
        if (existingSet.has(key)) continue;
        if (!newCats.has(tab)) {
          const cid = `cat_${slug(tab)}`;
          const ord =
            Math.max(0, ...categories.map((c) => c.order)) + newCats.size;
          const cat = { id: cid, name: tab, order: ord };
          newCats.set(tab, cat);
          console.log("Created new category:", cat);
        }
        const cat = newCats.get(tab);
        toAddQs.push({
          id: r.id || uid(),
          text,
          createdAt: r.createdAt || now(),
          done: false,
          categoryId: cat.id,
        });
        existingSet.add(key);
      }
      console.log("Categories after import:", Array.from(newCats.values()));
      console.log("Questions to add:", toAddQs);

      setCategories(Array.from(newCats.values()));
      if (toAddQs.length) setQuestions((prev) => [...prev, ...toAddQs]);
      // クリア
      e.target.value = "";
      toast("インポート完了", "ok");
    } catch (err) {
      console.error("Import error:", err);
      e.target.value = "";
      toast("インポート失敗：拡張子/必須列(text)/スキーマを確認", "warn");
    }
  };

  // エクスポート

  // 回答履歴 → Excel
  const exportAnswersXLSX = () => {
    const map = new Map(); // tabName -> rows[]
    for (const q of questions) {
      const tab =
        categories.find((c) => c.id === q.categoryId)?.name || "未分類";
      const arr = answers[q.id] || [];
      for (const a of arr) {
        if (!map.has(tab)) map.set(tab, []);
        map.get(tab).push({
          tab,
          question: q.text,
          answer: a.text,
          createdAt: new Date(a.createdAt).toLocaleString("ja-JP", {
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }), // yy/mm/dd hh:mm:ss 形式に整形
        });
      }
    }
    downloadXLSX(map, "answers.xlsx");
  };

  const exportAnswersCSV = () => {
    const rows = [];
    for (const q of questions) {
      const tab =
        categories.find((c) => c.id === q.categoryId)?.name || "未分類";
      const arr = answers[q.id] || [];
      for (const a of arr) {
        rows.push({
          tab,
          question: q.text,
          answer: a.text,
          createdAt: new Date(a.createdAt).toLocaleString(), // ← 文字列整形
        });
      }
    }
    downloadCSV(rows, "answers.csv");
  };

  // データ削除
  const purgeAll = () => {
    if (!confirm("すべてのデータを削除しますか？")) return;
    setCategories([]); // 空配列に変更
    setQuestions([]);
    setAnswers({});
    setActiveCategoryId("all_cats");
    setActiveTab("unanswered");
    setActiveQId(null);
    setQuery("");
    setCurrentAnswer("");
    setInterimText("");
    localStorage.removeItem(STORAGE_KEY);
    toast("データを初期化しました", "ok");
    setActiveHistoryCategoryId("all_cats"); // 回答履歴のカテゴリも初期化
  };

  // ショートカット
  useEffect(() => {
    const onKey = (e) => {
      // Enterダブルタップで回答を確定するロジックをここに移動
      if (e.key === "Enter" && !e.shiftKey) {
        // 編集モードでない、かつ質問が選択されている、かつターゲットがtextareaではない場合
        if (
          activeQId &&
          editingAnswerId === null &&
          e.target.tagName !== "TEXTAREA"
        ) {
          e.preventDefault(); // デフォルトの改行動作を抑制
          const now = Date.now();
          const DBL_ENTER_THRESHOLD_MS = 300; // 300ms以内に2回Enter
          if (now - lastEnterTimeRef.current < DBL_ENTER_THRESHOLD_MS) {
            confirmAnswer();
            lastEnterTimeRef.current = 0; // リセット
          } else {
            lastEnterTimeRef.current = now;
          }
        }
      } else {
        // Enter以外のキーが押されたらリセット (textarea内でのEnterはここには来ないため、ダブルタップ判定に影響しない)
        lastEnterTimeRef.current = 0;
      }

      // ヘルプ
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (e.key === "Escape") {
        if (helpOpen) {
          e.preventDefault();
          setHelpOpen(false);
          return;
        }
      }
      // 保存/削除/インポート
      if (e.ctrlKey && e.shiftKey && e.code === "KeyD") {
        e.preventDefault();
        purgeAll();
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.code === "KeyI") {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }
      // ナビゲーション
      if (e.key === "j" || e.key === "J") {
        const step = e.shiftKey ? 5 : 1;
        moveSelection(step);
        return;
      }
      if (e.key === "k" || e.key === "K") {
        const step = e.shiftKey ? -5 : -1;
        moveSelection(step);
        return;
      }
      if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        const list = filteredQuestions;
        if (list[idx]) setActiveQId(list[idx].id);
        return;
      }
      if (e.key === "u" || e.key === "U") {
        setActiveTab("unanswered");
        return;
      }
      if (e.key === "a" || e.key === "A") {
        setActiveTab("answered"); // 'all'から'answered'に変更
        return;
      }
      if (e.key === "o" || e.key === "O") {
        createOther();
        return;
      }
      if (
        e.ctrlKey &&
        e.altKey &&
        (e.key === "ArrowRight" || e.key === "ArrowLeft")
      ) {
        e.preventDefault();
        const idx = tabCategories.findIndex((c) => c.id === activeCategoryId);
        const next =
          e.key === "ArrowRight"
            ? Math.min(tabCategories.length - 1, idx + 1)
            : Math.max(0, idx - 1);
        setActiveCategoryId(tabCategories[next].id);
        return;
      }
      if (e.ctrlKey && e.altKey && /^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (tabCategories[idx]) setActiveCategoryId(tabCategories[idx].id);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filteredQuestions,
    activeCategoryId,
    tabCategories,
    helpOpen,
    activeQId,
    editingAnswerId,
    currentAnswer,
    interimText,
  ]); // 依存配列に新しい状態を追加

  const moveSelection = (delta) => {
    const list = filteredQuestions;
    if (!list.length) return;
    const idx = Math.max(
      0,
      list.findIndex((q) => q.id === activeQId)
    );
    const next = Math.min(list.length - 1, Math.max(0, idx + delta));
    setActiveQId(list[next].id);
  };

  // トースト（簡易）
  const [toastMsg, setToastMsg] = useState(null);
  function toast(msg, type = "ok") {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 1600);
  }

  // UI
  return (
    <div className="min-h-screen flex flex-col">
      {/* ヘッダ */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold mr-2">相談対応用アプリ</h1>
          {/* インポート・エクスポートボタンのグループ */}
          <div className="flex gap-2">
            <label className={BTN_IMPORT + " cursor-pointer"}>
              {" "}
              {/* 青色 */}
              質問をインポート
              <input
                ref={fileInputRef}
                onChange={onImportFile}
                type="file"
                accept=".csv,.xlsx,.json"
                className="hidden"
              />
            </label>
            <button className={BTN_EXPORT} onClick={exportAnswersXLSX}>
              {" "}
              {/* 緑色 */}
              回答履歴Excel
            </button>
            <button className={BTN_EXPORT} onClick={exportAnswersCSV}>
              {" "}
              {/* 緑色 */}
              回答履歴CSV
            </button>
          </div>
          {/* ヘルプ・データ削除ボタンのグループ（右寄せ） */}
          <div className="ml-auto flex items-center gap-2">
            <button className={BTN_SOFT} onClick={() => setHelpOpen(true)}>
              {" "}
              {/* 既存の色 */}
              ヘルプ
            </button>
            <button className={BTN_DELETE} onClick={purgeAll}>
              {" "}
              {/* 赤色 */}
              データ削除
            </button>
          </div>
        </div>
      </header>

      {/* メイン 2カラム */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-12 gap-4">
        {/* 左カラム：カテゴリ＋質問 */}
        <section className="col-span-12 lg:col-span-5 xl:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-col">
          {/* カテゴリタブバー（横スクロール） */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {tabCategories.map((cat) => (
              <button
                key={cat.id}
                className={`${TAB_BTN} ${
                  activeCategoryId === cat.id ? TAB_ACTIVE : TAB_IDLE
                }`}
                onClick={() => setActiveCategoryId(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* 二段タブ */}
          <div className="mt-2 flex items-center gap-2">
            <button
              className={`${TAB_BTN} ${
                activeTab === "unanswered" ? TAB_ACTIVE : TAB_IDLE
              }`}
              onClick={() => setActiveTab("unanswered")}
            >
              未回答
            </button>
            <button
              className={`${TAB_BTN} ${
                activeTab === "answered" ? TAB_ACTIVE : TAB_IDLE
              }`}
              onClick={() => setActiveTab("answered")}
            >
              回答済み
            </button>
            <button className={BTN_OTHER + " ml-auto"} onClick={createOther}>
              新規質問（OTHER）
            </button>
          </div>

          {/* 検索 */}
          <div className="mt-3">
            <input
              id="q"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="質問を検索（部分一致）"
              className={INPUT + " w-full"}
            />
          </div>

          {/* リスト */}
          <div className="mt-3 flex-1 overflow-y-scroll max-h-[60vh]">
            <ul className="divide-y divide-slate-200">
              {filteredQuestions.map((q) => (
                <li
                  key={q.id}
                  className={`p-3 hover:bg-slate-50 cursor-pointer ${
                    activeQId === q.id ? "bg-slate-50" : ""
                  }`}
                  onClick={() => handleQuestionClick(q.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{q.text}</span>
                    {q.done ? (
                      <span
                        className={`text-xs border rounded px-2 py-0.5 ${BADGE_EMERALD}`}
                      >
                        済
                      </span>
                    ) : (
                      <span
                        className={`text-xs border rounded px-2 py-0.5 ${BADGE_AMBER}`}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(q.createdAt).toLocaleString()} ・{" "}
                    {categories.find((c) => c.id === q.categoryId)?.name ||
                      "General"}
                  </div>
                </li>
              ))}
              {!filteredQuestions.length && (
                <li className="p-6 text-center text-slate-500">
                  該当する質問がありません
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* 右カラム：回答エリア／履歴 */}
        <section className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          {/* アクティブ質問 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              {/* 質問文の左側に録音マークを追加 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">録音</span>
                <StatusDot
                  state={recordState}
                  title={`state: ${recordState}`}
                />
                <h2 className="text-lg font-semibold">
                  {activeQId === OTHER_ID
                    ? "新規（OTHER）"
                    : activeQuestion?.text || "質問を選択"}
                </h2>
              </div>
              <div className="flex gap-2 ml-auto">
                {" "}
                {/* ml-auto を追加 */}
                {recordState !== "recording" && (
                  <button
                    className={BTN_PRIMARY}
                    onClick={() => {
                      if (activeQId) {
                        speech.startRecordingFor(activeQId);
                      } else {
                        createOther();
                        speech.startRecordingOther();
                      }
                    }}
                  >
                    録音開始
                  </button>
                )}
                {recordState === "recording" && (
                  <button className={BTN_SOFT} onClick={speech.pauseOrEnd}>
                    一時停止
                  </button>
                )}
                {(recordState === "recording" || recordState === "paused") && (
                  <button className={BTN_SOFT} onClick={speech.stopNow}>
                    停止
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3">
              <textarea
                id="answer"
                name="answer"
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="回答を入力（音声入力の確定分はここに蓄積、途中認識は下に表示）"
                className={INPUT + " w-full min-h-[60px]"}
              />
              {interimText && (
                <div className="mt-2 text-sm text-slate-500 p-2 rounded bg-slate-50 border border-slate-200">
                  途中認識：{interimText}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button className={BTN_PRIMARY} onClick={confirmAnswer}>
                  確定
                </button>
                <button className={BTN_SOFT} onClick={cancelAnswer}>
                  取消
                </button>
              </div>
            </div>
          </div>

          {/* 履歴 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col">
            {/* タイトルとカテゴリタブバーを横並びにする新しいコンテナ */}
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-base font-semibold">回答履歴</h3>
              {/* 回答履歴のカテゴリタブバー */}
              <div className="flex items-center gap-2 overflow-x-auto">
                {tabCategories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`${TAB_BTN} ${
                      activeHistoryCategoryId === cat.id ? TAB_ACTIVE : TAB_IDLE
                    }`}
                    onClick={() => setActiveHistoryCategoryId(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-scroll grid gap-3 max-h-[50vh]">
              {renderHistoryCards(
                answers,
                questions,
                categories,
                activeHistoryCategoryId, // activeHistoryCategoryId を使用
                editingAnswerId,
                editingAnswerText,
                setEditingAnswerText,
                handleEditAnswerClick,
                handleSaveEditedAnswer,
                handleCancelEdit,
                handleDeleteAnswer
              )}
            </div>
          </div>
        </section>
      </main>

      {/* フッタ */}
      <footer className="border-t border-slate-200 py-3 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} SupportAssistantApp
      </footer>

      {/* モーダル */}
      <ShortcutHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* トースト */}
      {toastMsg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`px-4 py-2 rounded-xl shadow ${
              toastMsg.type === "ok"
                ? "bg-emerald-600 text-white"
                : "bg-amber-600 text-white"
            }`}
          >
            {toastMsg.msg}
          </div>
        </div>
      )}
    </div>
  );
}

// 関数定義側（引数に activeCategoryId を追加し絞り込み）
function renderHistoryCards(
  answers,
  questions,
  categories,
  activeCategoryId,
  editingAnswerId,
  editingAnswerText,
  setEditingAnswerText,
  handleEditAnswerClick,
  handleSaveEditedAnswer,
  handleCancelEdit,
  handleDeleteAnswer
) {
  const items = [];
  for (const q of questions) {
    if (activeCategoryId !== "all_cats" && q.categoryId !== activeCategoryId)
      continue;
    const arr = answers[q.id] || [];
    for (const a of arr) {
      items.push({
        qid: q.id,
        qtext: q.text,
        aid: a.id, // 回答IDを追加
        atext: a.text,
        createdAt: a.createdAt,
        categoryId: q.categoryId,
        meta: a.meta || {},
      });
    }
  }
  items.sort((a, b) => b.createdAt - a.createdAt);
  if (!items.length)
    return <p className="text-slate-500">まだ履歴がありません</p>;
  return items.map((it, idx) => (
    <article key={idx} className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <time className="text-xs text-slate-500">
          {new Date(it.createdAt).toLocaleString()}
        </time>
        <span className="text-xs text-slate-500">
          {categories.find((c) => c.id === it.categoryId)?.name || "未分類"}
          {it.meta.isFromOther && " ・ [OTHERから作成]"}
        </span>
      </div>
      <h4 className="mt-1 text-sm line-clamp-2">{it.qtext}</h4>
      {editingAnswerId === `${it.qid}-${it.aid}` ? (
        <div className="mt-2">
          <textarea
            value={editingAnswerText}
            onChange={(e) => setEditingAnswerText(e.target.value)}
            className="w-full min-h-[80px] px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
          />
          <div className="mt-2 flex gap-2">
            <button
              className={BTN_PRIMARY}
              onClick={() => handleSaveEditedAnswer(it.qid, it.aid)}
            >
              保存
            </button>
            <button className={BTN_SOFT} onClick={handleCancelEdit}>
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm whitespace-pre-wrap font-bold">{it.atext}</p>
      )}

      <div className="mt-3 flex gap-2 justify-end">
        {/* 編集ボタンを青色に変更 */}
        <button
          className={BTN_PRIMARY}
          onClick={() => handleEditAnswerClick(it.qid, it.aid, it.atext)}
          disabled={editingAnswerId !== null} // 編集中は他のボタンを無効化
        >
          編集
        </button>
        {/* 削除ボタンを赤色に変更 */}
        <button
          className={BTN_DELETE} // 赤色
          onClick={() => handleDeleteAnswer(it.qid, it.aid)}
          disabled={editingAnswerId !== null} // 編集中は他のボタンを無効化
        >
          削除
        </button>
      </div>
    </article>
  ));
}
