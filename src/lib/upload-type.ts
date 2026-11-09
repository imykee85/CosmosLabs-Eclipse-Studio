// The type a browser gives a video is often missing or generic (MKV, AVI, WMV, some MOV and MP4 exports send "" or application/octet-stream).
// The server reads the real type from the file's bytes at the end, so the browser only needs a sensible type to start the upload with.
const VIDEO_BY_EXT: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/x-m4v", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo",
  "3gp": "video/3gpp", mpg: "video/mpeg", mpeg: "video/mpeg", ts: "video/mp2t", mts: "video/mp2t", m2ts: "video/mp2t", wmv: "video/x-ms-wmv", flv: "video/x-flv",
  qt: "video/quicktime", "3g2": "video/3gpp2", m2v: "video/mpeg", vob: "video/mpeg", asf: "video/x-ms-asf", f4v: "video/x-f4v", ogv: "video/ogg",
};

/** The content type to upload a video with: the browser's own when it is a real video type, else one worked out from the file name. */
export function videoUploadType(file: { name: string; type: string }): string {
  if (file.type && file.type !== "application/octet-stream" && file.type.startsWith("video/")) return file.type;
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  return VIDEO_BY_EXT[ext] ?? file.type ?? "";
}
