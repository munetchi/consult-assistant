import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = { hasError:false, error:null, info:null };
  }
  static getDerivedStateFromError(error){ return { hasError:true, error }; }
  componentDidCatch(error, info){ this.setState({ info }); }
  handleReload = () => location.reload();
  handleGoTop = () => window.scrollTo({ top:0, behavior:'smooth' });

  render(){
    if(!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 flex items-center justify-center p-6">
        <div className="max-w-3xl w-full bg-white rounded-2xl shadow p-8">
          <h1 className="text-2xl font-bold mb-3">問題が発生しました</h1>
          <p className="mb-4 text-slate-600">一時的な不具合の可能性があります。下の操作をお試しください。</p>
          <div className="flex gap-3">
            <button onClick={this.handleReload} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">リロード</button>
            <button onClick={this.handleGoTop} className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300">トップへ戻る</button>
            <details className="ml-auto">
              <summary className="cursor-pointer select-none">詳細</summary>
              <pre className="mt-2 text-xs overflow-auto max-h-64 bg-slate-50 p-3 rounded">{String(this.state.error)}{"\n"}{this.state.info?.componentStack}</pre>
            </details>
          </div>
        </div>
      </div>
    );
  }
}
