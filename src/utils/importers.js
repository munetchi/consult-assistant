import Papa from "papaparse";
import * as XLSX from "xlsx";

// 正規化前の配列を返す： { tab, text, id?, createdAt? }[]
export async function parseFile(file) {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "csv") {
    const text = await file.text();
    const { data, errors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });
    if (errors.length) throw new Error("CSV parse error");
    return (data || [])
      .map((r) => ({
        tab: (r.tab || "").trim(),
        text: (r.text || "").trim(),
        id: r.id?.trim?.() || undefined,
        createdAt: r.createdAt ? Number(r.createdAt) : undefined,
      }))
      .filter((r) => r.text);
  }
  if (ext === "xlsx") {
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });
    let rows = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (json.length === 0) continue;

      // 列名を正規化して検索
      const firstRow = json[0];
      const columns = Object.keys(firstRow);

      // text列を探す（大文字小文字を無視）
      const textColumn = columns.find(
        (col) =>
          col.toLowerCase() === "text" ||
          col.toLowerCase() === "質問" ||
          col.toLowerCase() === "question"
      );

      // tab列を探す（大文字小文字を無視）
      const tabColumn = columns.find(
        (col) =>
          col.toLowerCase() === "tab" ||
          col.toLowerCase() === "カテゴリ" ||
          col.toLowerCase() === "category"
      );

      // id列を探す（大文字小文字を無視）
      const idColumn = columns.find((col) => col.toLowerCase() === "id");

      // createdAt列を探す（大文字小文字を無視）
      const createdAtColumn = columns.find(
        (col) =>
          col.toLowerCase() === "createdat" ||
          col.toLowerCase() === "created_at" ||
          col.toLowerCase() === "作成日時"
      );

      if (textColumn) {
        // text列が見つかった場合
        json.forEach((r) => {
          const text = (r[textColumn] ?? "").toString().trim();
          if (!text) return;

          rows.push({
            tab: tabColumn ? (r[tabColumn] || "").toString().trim() : sheetName,
            text,
            id: idColumn
              ? (r[idColumn] || "").toString().trim() || undefined
              : undefined,
            createdAt:
              createdAtColumn && r[createdAtColumn]
                ? Number(r[createdAtColumn])
                : undefined,
          });
        });
      } else {
        // text列が見つからない場合は、最初の列をtextとして扱う
        const firstColumn = columns[0];
        json.forEach((r) => {
          const text = (r[firstColumn] ?? "").toString().trim();
          if (!text) return;

          rows.push({
            tab: sheetName,
            text,
            id: undefined,
            createdAt: undefined,
          });
        });
      }
    }
    return rows.filter((r) => r.text);
  }
  if (ext === "json") {
    const txt = await file.text();
    const obj = JSON.parse(txt);
    if (Array.isArray(obj)) {
      // フラット
      return obj
        .map((r) => ({
          tab: (r.tab || "").toString().trim(),
          text: (r.text || "").toString().trim(),
          id: r.id,
          createdAt: r.createdAt ? Number(r.createdAt) : undefined,
        }))
        .filter((r) => r.text);
    }
    if (obj && Array.isArray(obj.tabs)) {
      // ネスト
      const out = [];
      for (const t of obj.tabs) {
        const name = (t.name || "").toString().trim();
        const items = Array.isArray(t.items) ? t.items : [];
        for (const it of items) {
          const text = (it.text || "").toString().trim();
          if (!text) continue;
          out.push({
            tab: name,
            text,
            id: it.id,
            createdAt: it.createdAt ? Number(it.createdAt) : undefined,
          });
        }
      }
      return out;
    }
    throw new Error("JSON schema not supported");
  }
  throw new Error("Unsupported extension");
}
