export interface Team {
  id: string;
  name: string;
  players?: { name: string; position: string }[]; // チームに所属する選手の情報
  // 今後、他の情報（例：監督名など）を追加できます
}