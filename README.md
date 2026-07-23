# meta-qualia

OSINT向けの画像編集・メタデータ閲覧ツール。ブラウザ内で完結する静的サイト(Cloudflare Workers Static Assets)として動作し、サーバーへのアップロードは一切発生しません。

## 機能

- **画像編集**: 主要な画像形式(JPEG/PNG/GIF/WebP/BMP/AVIF/SVG)に対応。明度・コントラスト・彩度・色相・グレースケール・階調反転・セピア・ぼかしをリアルタイム調整、ズーム/パン、回転・反転、PNG/JPEG/WebPで書き出し(推定ファイルサイズ表示付き)
- **自動調整**: ヒストグラム解析により明度/コントラスト/彩度を自動で最適化するワンクリック補正
- **メタデータ閲覧**: 画像(EXIF/GPS/IPTC/XMP/ICC)・PDF・Office/ODF文書・音声/動画・その他任意のファイルのメタデータを解析。非対応形式はハッシュ値(SHA-256/SHA-1)とhexダンプにフォールバック
- **ExifTool詳細解析**: 実際のExifTool(WebAssembly版)を用いた全タグの読み取り・自由編集・削除(GPS位置情報のみ削除/全メタデータ削除のプリセット付き)、編集後のファイルダウンロード

## 開発

```bash
npm install
npm run dev
```

## ビルド / デプロイ

```bash
npm run build     # 本番ビルド
npm run cf:dev     # Cloudflare Workers環境でのローカル確認 (wrangler dev)
npm run deploy      # ビルド後、Cloudflare Workersへデプロイ
```

## 技術構成

React + TypeScript + Vite。画像処理はCanvas 2D、メタデータ抽出は `exifr` / `pdfjs-dist` / `jszip` / `music-metadata` / `@uswriting/exiftool` (WASM) を使用。プロキシを介さない完全な静的サイトのため、URLからのファイル取得はCORSを許可しているサーバーに限られます。
