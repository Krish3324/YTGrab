from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import yt_dlp
import os
import tempfile
import glob
import subprocess
import threading
import shutil
import time

app = Flask(__name__)
CORS(app)

def check_ffmpeg():
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def cleanup_later(folder_path, delay=60):
    def _delete():
        time.sleep(delay)
        try:
            shutil.rmtree(folder_path, ignore_errors=True)
        except Exception:
            pass
    threading.Thread(target=_delete, daemon=True).start()

@app.route("/health", methods=["GET"])
def health():
    ffmpeg_ok = check_ffmpeg()
    return jsonify({
        "status": "ok",
        "ffmpeg": ffmpeg_ok,
        "message": "ffmpeg is ready" if ffmpeg_ok else "ffmpeg NOT found"
    })

@app.route("/", methods=["POST"])
def download():
    data = request.json
    url = data.get("url")
    quality = data.get("videoQuality", "1080")
    audio_only = data.get("downloadMode") == "audio"
    audio_bitrate = data.get("audioBitrate", "192")

    if not url:
        return jsonify({"status": "error", "error": "No URL provided"}), 400

    try:
        tmpdir = tempfile.mkdtemp()
        output_template = os.path.join(tmpdir, "%(title)s.%(ext)s")

        if audio_only:
            ydl_opts = {
                "format": "bestaudio[ext=m4a]/bestaudio/best",
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": str(audio_bitrate),
                }],
                "outtmpl": output_template,
                "quiet": True,
                "no_warnings": True,
                # ✅ Speed: parallel fragment downloads
                "concurrent_fragment_downloads": 5,
                "buffersize": 1024 * 16,
                "http_chunk_size": 10485760,  # 10MB chunks
            }
        else:
            # ✅ For 1080p and below — prefer pre-merged formats (no merging needed = instant)
            if int(quality) <= 1080:
                fmt = (
                    f"best[height<={quality}][ext=mp4]"          # pre-merged, no ffmpeg needed
                    f"/bestvideo[height<={quality}][ext=mp4]+bestaudio[ext=m4a]"
                    f"/bestvideo[height<={quality}]+bestaudio"
                    f"/best[height<={quality}]"
                    f"/best"
                )
            else:
                # 1440p / 4K must be merged (no pre-merged available)
                fmt = (
                    f"bestvideo[height<={quality}][ext=mp4]+bestaudio[ext=m4a]"
                    f"/bestvideo[height<={quality}]+bestaudio"
                    f"/best[height<={quality}]"
                    f"/best"
                )

            ydl_opts = {
                "format": fmt,
                "merge_output_format": "mp4",
                "outtmpl": output_template,
                "quiet": True,
                "no_warnings": True,
                # ✅ Speed: parallel fragment downloads
                "concurrent_fragment_downloads": 5,
                "buffersize": 1024 * 16,
                "http_chunk_size": 10485760,  # 10MB chunks
                "postprocessor_args": {
                    # ✅ Speed: copy streams — no re-encoding
                    "merger": ["-c:v", "copy", "-c:a", "copy"],
                },
            }

        print(f"[YT Grab] Downloading: {url} | quality={quality} | audio_only={audio_only}")
        start = time.time()

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "video")
            actual_height = info.get("height", "?")

        elapsed = time.time() - start
        print(f"[YT Grab] Done in {elapsed:.1f}s: '{title}' at {actual_height}p")

        ext = "mp3" if audio_only else "mp4"
        files = glob.glob(os.path.join(tmpdir, f"*.{ext}"))
        if not files:
            files = glob.glob(os.path.join(tmpdir, "*.*"))

        if not files:
            return jsonify({"status": "error", "error": "No output file found after download"}), 500

        output_file = files[0]
        file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
        print(f"[YT Grab] Sending: {output_file} ({file_size_mb:.1f} MB)")

        safe_title = "".join(
            c for c in title if c.isalnum() or c in " -_()"
        ).strip()[:80] or "video"

        download_name = f"{safe_title}.{ext}"
        mimetype = "audio/mpeg" if audio_only else "video/mp4"

        # ✅ Speed: stream file in chunks instead of loading into memory
        def generate():
            with open(output_file, "rb") as f:
                while chunk := f.read(1024 * 256):  # 256KB chunks
                    yield chunk
            cleanup_later(tmpdir, delay=30)

        return Response(
            generate(),
            mimetype=mimetype,
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "Content-Length": str(os.path.getsize(output_file)),
                "X-File-Size-MB": f"{file_size_mb:.1f}",
            }
        )

    except yt_dlp.utils.DownloadError as e:
        err = str(e)
        print(f"[YT Grab] yt-dlp error: {err}")
        if "ffmpeg" in err.lower():
            return jsonify({
                "status": "error",
                "error": "ffmpeg is not installed. Please install ffmpeg and restart the server."
            }), 500
        return jsonify({"status": "error", "error": err[:300]}), 500

    except Exception as e:
        print(f"[YT Grab] Unexpected error: {e}")
        return jsonify({"status": "error", "error": str(e)[:300]}), 500


if __name__ == "__main__":
    print("=" * 50)
    print("  YT Grab — Local yt-dlp Server  [FAST MODE]")
    print("=" * 50)
    if check_ffmpeg():
        print("  ✅ ffmpeg found — all resolutions supported")
    else:
        print("  ❌ ffmpeg NOT found!")
        print("  Run: winget install --id Gyan.FFmpeg -e")
        print("  Then restart this server.")
    print("  Server starting on http://127.0.0.1:9000")
    print("=" * 50)
    app.run(port=9000, debug=False, threaded=True)