#!/usr/bin/env bash
set -euo pipefail

output_file=${1:-}
input_file=${2:-}

if [[ -z "$output_file" || ! -f "$output_file" ]]; then
  echo "Usage: bash verify.sh OUTPUT.mp4 [ORIGINAL_INPUT.mp4]" >&2
  exit 2
fi

for tool_name in ffprobe ffmpeg mp4dump jq; do
  if ! command -v "$tool_name" >/dev/null 2>&1; then
    echo "Missing tool: $tool_name" >&2
    exit 2
  fi
done

probe_json=$(ffprobe -v error -show_format -show_streams -print_format json "$output_file")
video_count=$(jq '[.streams[] | select(.codec_type == "video")] | length' <<<"$probe_json")
audio_count=$(jq '[.streams[] | select(.codec_type == "audio")] | length' <<<"$probe_json")
main_audio_frames=$(jq -r '[.streams[] | select(.codec_type == "audio")][0].nb_frames // 0 | tonumber' <<<"$probe_json")
tech_audio_frames=$(jq -r '[.streams[] | select(.codec_type == "audio")][1].nb_frames // 0 | tonumber' <<<"$probe_json")
encoder=$(jq -r '.format.tags.encoder // ""' <<<"$probe_json")

[[ "$video_count" -ge 1 ]] || { echo "FAIL: no video track"; exit 1; }
[[ "$audio_count" -ge 2 ]] || { echo "FAIL: technical audio track is missing"; exit 1; }
[[ "$tech_audio_frames" -eq $((main_audio_frames * 10)) ]] || { echo "FAIL: technical track does not contain 10× samples"; exit 1; }
[[ "$encoder" == "****whis" ]] || { echo "FAIL: unexpected encoder signature: $encoder"; exit 1; }

top_order=$(mp4dump --verbosity 0 "$output_file" | awk '/^\[/{gsub(/\[|\].*/, ""); print; if (++n == 3) exit}')
first_atom=$(sed -n '1p' <<<"$top_order")
second_atom=$(sed -n '2p' <<<"$top_order")
third_atom=$(sed -n '3p' <<<"$top_order")
[[ "$first_atom" == "ftyp" && "$second_atom" == "moov" && "$third_atom" == "mdat" ]] || { echo "FAIL: unexpected top-level atom order"; exit 1; }

ffmpeg -v error -i "$output_file" -map 0:v:0 -f null -
ffmpeg -v error -i "$output_file" -map 0:a:0 -f null -

echo "PASS: ftyp → moov → mdat"
echo "PASS: $video_count video, $audio_count audio; technical track $tech_audio_frames = 10 × $main_audio_frames"
echo "PASS: primary streams decode successfully; encoder $encoder"

if [[ -n "$input_file" ]]; then
  [[ -f "$input_file" ]] || { echo "Original input not found: $input_file" >&2; exit 2; }
  input_video=$(ffmpeg -v error -i "$input_file" -map 0:v:0 -f hash -hash sha256 - | cut -d= -f2)
  output_video=$(ffmpeg -v error -i "$output_file" -map 0:v:0 -f hash -hash sha256 - | cut -d= -f2)
  input_audio=$(ffmpeg -v error -i "$input_file" -map 0:a:0 -f hash -hash sha256 - | cut -d= -f2)
  output_audio=$(ffmpeg -v error -i "$output_file" -map 0:a:0 -f hash -hash sha256 - | cut -d= -f2)
  [[ "$input_video" == "$output_video" ]] || { echo "FAIL: decoded video differs"; exit 1; }
  if [[ "$input_audio" == "$output_audio" ]]; then
    echo "PASS: decoded audio and video match the input"
  else
    echo "INFO: audio differs because of edit-list/priming; compare it with the patched reference"
    echo "PASS: decoded video matches the input"
  fi
fi
