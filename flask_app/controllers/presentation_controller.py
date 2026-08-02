import io
import os
import uuid

from flask import Blueprint, jsonify, request, send_file, session
from pypdf import PdfReader

from controllers.main_controller import login_required
from models import Presentation, Room, User, db

presentation_routes = Blueprint("presentation", __name__, url_prefix="/api")

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "presentations")
os.makedirs(STORAGE_DIR, exist_ok=True)


def _storage_path(storage_key):
  return os.path.join(STORAGE_DIR, storage_key)


def _upload_response(presentation):
  return {
    "id": presentation.id,
    "roomId": presentation.room_id,
    "originalFilename": presentation.original_filename,
    "fileSize": presentation.file_size,
    "totalPages": presentation.total_pages,
    "currentPage": presentation.current_page,
    "status": presentation.status,
    "createdAt": presentation.created_at.isoformat(),
    "updatedAt": presentation.updated_at.isoformat(),
  }


def _tutor_metadata(presentation):
  return {
    "id": presentation.id,
    "roomId": presentation.room_id,
    "originalFilename": presentation.original_filename,
    "fileSize": presentation.file_size,
    "totalPages": presentation.total_pages,
    "currentPage": presentation.current_page,
    "status": presentation.status,
    "fileUrl": f"/api/presentation/{presentation.id}/file",
    "updatedAt": presentation.updated_at.isoformat(),
  }


def _state_response(presentation):
  return {
    "presentationId": presentation.id,
    "roomId": presentation.room_id,
    "currentPage": presentation.current_page,
    "totalPages": presentation.total_pages,
    "status": presentation.status,
    "updatedAt": presentation.updated_at.isoformat(),
  }


def _get_tutor_and_room(room_id):
  """講師本人かつ対象ルームの所有者であることを確認する。"""
  user = db.session.get(User, session.get("user_id"))
  if user is None or not user.isTutor:
    return None, None, (jsonify({"error": "権限がありません"}), 403)

  room = Room.get_by_id(room_id)
  if room is None or room.user_id != user.id:
    return None, None, (jsonify({"error": "部屋が見つかりません"}), 404)

  return user, room, None


def _get_tutor_presentation(presentation_id):
  presentation = Presentation.get_by_id(presentation_id)
  if presentation is None:
    return None, (jsonify({"error": "プレゼンテーションが見つかりません"}), 404)

  _, _, error = _get_tutor_and_room(presentation.room_id)
  if error:
    return None, error

  return presentation, None


def _validate_pdf(file_storage):
  """PDFファイルを検証し、(バイト列, 総ページ数, エラーレスポンス)を返す。"""
  if file_storage is None or file_storage.filename == "":
    return None, None, (jsonify({"error": "ファイルを選択してください"}), 400)

  if not file_storage.filename.lower().endswith(".pdf"):
    return None, None, (jsonify({"error": "PDFファイルのみアップロードできます"}), 400)

  if file_storage.mimetype != "application/pdf":
    return None, None, (jsonify({"error": "PDFファイルのみアップロードできます"}), 400)

  data = file_storage.read()

  if len(data) == 0:
    return None, None, (jsonify({"error": "空のファイルはアップロードできません"}), 400)

  if len(data) > MAX_FILE_SIZE:
    return None, None, (jsonify({"error": "ファイルサイズは50MBまでです"}), 400)

  if not data.startswith(b"%PDF-"):
    return None, None, (jsonify({"error": "不正なPDFファイルです"}), 400)

  try:
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
      return None, None, (jsonify({"error": "暗号化されたPDFは利用できません"}), 400)
    total_pages = len(reader.pages)
  except Exception:
    return None, None, (jsonify({"error": "PDFの読み込みに失敗しました"}), 400)

  if total_pages < 1:
    return None, None, (jsonify({"error": "ページ数が0のPDFは利用できません"}), 400)

  return data, total_pages, None


@presentation_routes.route("/room/<int:room_id>/presentation", methods=["POST"])
@login_required
def upload_presentation(room_id):
  _, _, error = _get_tutor_and_room(room_id)
  if error:
    return error

  data, total_pages, error = _validate_pdf(request.files.get("file"))
  if error:
    return error

  original_filename = request.files["file"].filename
  storage_key = f"{uuid.uuid4().hex}.pdf"
  file_path = _storage_path(storage_key)

  try:
    with open(file_path, "wb") as f:
      f.write(data)
  except OSError:
    return jsonify({"error": "ファイルの保存に失敗しました"}), 500

  existing = Presentation.get_by_room_id(room_id)
  old_storage_key = existing.storage_key if existing is not None else None

  try:
    if existing is not None:
      presentation = existing.replace_file(
        original_filename=original_filename,
        storage_key=storage_key,
        content_type="application/pdf",
        file_size=len(data),
        total_pages=total_pages,
      )
    else:
      presentation = Presentation.create(
        room_id=room_id,
        original_filename=original_filename,
        storage_key=storage_key,
        content_type="application/pdf",
        file_size=len(data),
        total_pages=total_pages,
      )
  except Exception:
    db.session.rollback()
    if os.path.exists(file_path):
      os.remove(file_path)
    return jsonify({"error": "保存に失敗しました"}), 500

  if old_storage_key is not None:
    old_path = _storage_path(old_storage_key)
    if os.path.exists(old_path):
      try:
        os.remove(old_path)
      except OSError:
        pass

  return jsonify(_upload_response(presentation)), 201


@presentation_routes.route("/room/<int:room_id>/presentation", methods=["GET"])
@login_required
def get_presentation(room_id):
  _, _, error = _get_tutor_and_room(room_id)
  if error:
    return error

  presentation = Presentation.get_by_room_id(room_id)
  if presentation is None:
    return jsonify({"error": "プレゼンテーションが登録されていません"}), 404

  return jsonify(_tutor_metadata(presentation))


@presentation_routes.route("/room/<int:room_id>/presentation", methods=["DELETE"])
@login_required
def delete_presentation(room_id):
  _, _, error = _get_tutor_and_room(room_id)
  if error:
    return error

  presentation = Presentation.get_by_room_id(room_id)
  if presentation is None:
    return jsonify({"error": "プレゼンテーションが登録されていません"}), 404

  file_path = _storage_path(presentation.storage_key)
  presentation.delete()

  if os.path.exists(file_path):
    try:
      os.remove(file_path)
    except OSError:
      pass

  return "", 204


@presentation_routes.route("/presentation/<int:presentation_id>/file", methods=["GET"])
@login_required
def get_presentation_file(presentation_id):
  presentation, error = _get_tutor_presentation(presentation_id)
  if error:
    return error

  file_path = _storage_path(presentation.storage_key)
  if not os.path.exists(file_path):
    return jsonify({"error": "ファイルが見つかりません"}), 404

  response = send_file(
    file_path,
    mimetype="application/pdf",
    as_attachment=False,
    conditional=True,
    download_name=presentation.original_filename,
    max_age=0,
  )
  response.headers["Cache-Control"] = "private"
  return response


@presentation_routes.route("/presentation/<int:presentation_id>/current-page", methods=["PATCH"])
@login_required
def update_current_page(presentation_id):
  presentation, error = _get_tutor_presentation(presentation_id)
  if error:
    return error

  body = request.get_json(silent=True) or {}
  current_page = body.get("currentPage")
  total_pages = body.get("totalPages")

  if total_pages is not None and total_pages != presentation.total_pages:
    return jsonify({"error": "totalPagesが一致しません"}), 409

  if not isinstance(current_page, int) or isinstance(current_page, bool):
    return jsonify({"error": "currentPageは整数で指定してください"}), 400

  if current_page < 1 or current_page > presentation.total_pages:
    return jsonify({"error": "ページ番号が範囲外です"}), 400

  if presentation.status == Presentation.STATUS_ENDED:
    return jsonify({"error": "終了したプレゼンテーションは更新できません"}), 400

  if current_page != presentation.current_page:
    presentation.update_current_page(current_page)

  return jsonify(_state_response(presentation))


@presentation_routes.route("/presentation/<int:presentation_id>/start", methods=["POST"])
@login_required
def start_presentation(presentation_id):
  presentation, error = _get_tutor_presentation(presentation_id)
  if error:
    return error

  presentation.set_status(Presentation.STATUS_PRESENTING)
  return jsonify(_tutor_metadata(presentation))


@presentation_routes.route("/presentation/<int:presentation_id>/end", methods=["POST"])
@login_required
def end_presentation(presentation_id):
  presentation, error = _get_tutor_presentation(presentation_id)
  if error:
    return error

  presentation.set_status(Presentation.STATUS_ENDED)
  return jsonify(_tutor_metadata(presentation))


@presentation_routes.route("/room/<int:room_id>/presentation/state", methods=["GET"])
def get_presentation_state(room_id):
  room = Room.get_by_id(room_id)
  if room is None:
    return jsonify({"error": "部屋が見つかりません"}), 404

  presentation = Presentation.get_by_room_id(room_id)
  if presentation is None:
    return jsonify({"error": "プレゼンテーションが登録されていません"}), 404

  if room.isFinished:
    return jsonify(_state_response(presentation)), 410

  return jsonify(_state_response(presentation))
