import React from 'react';

export default function ShortcutHelpModal({ open, onClose }){
  if(!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-[720px] max-w-[92vw] bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">ショートカット一覧</h2>
          <button onClick={onClose} className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300">閉じる（Esc）</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <KeyRow k="?">ヘルプ表示</KeyRow>
          <KeyRow k="Esc">閉じる</KeyRow>
          <KeyRow k="Ctrl+Shift+C">CSV保存</KeyRow>
          <KeyRow k="Ctrl+Shift+X">Excel保存</KeyRow>
          <KeyRow k="Ctrl+Shift+J">JSON保存</KeyRow>
          <KeyRow k="Ctrl+Shift+D">データ削除</KeyRow>
          <KeyRow k="Ctrl+Shift+I">質問をインポート</KeyRow>
          <KeyRow k="J / K">次／前の質問</KeyRow>
          <KeyRow k="Shift+J / Shift+K">高速移動（+5）</KeyRow>
          <KeyRow k="1-9">該当質問にジャンプ</KeyRow>
          <KeyRow k="U / A">未回答／すべて 切替</KeyRow>
          <KeyRow k="O">OTHER 作成</KeyRow>
          <KeyRow k="Ctrl+Alt+←/→">カテゴリ 前後</KeyRow>
          <KeyRow k="Ctrl+Alt+1..9">カテゴリ 直接選択</KeyRow>
        </div>
      </div>
    </div>
  );
}

function KeyRow({k, children}){
  return (
    <div className="flex items-center gap-3">
      <code className="px-2 py-1 rounded bg-slate-100 border border-slate-200">{k}</code>
      <span>{children}</span>
    </div>
  );
}
