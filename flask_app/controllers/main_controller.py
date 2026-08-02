from collections import Counter
from functools import wraps

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from models import Reaction, Room, User, db

import io

import qrcode
from qrcode.constants import ERROR_CORRECT_H

from flask import send_file

main = Blueprint('main', __name__, url_prefix='/api')


def login_required(view):
  @wraps(view)
  def wrapped_view(*args, **kwargs):
    if "user_id" not in session:
      return jsonify({"error": "ログインしてください"}), 401
    return view(*args, **kwargs)

  return wrapped_view


def room_to_dict(room):
  return {"id": room.id, "name": room.name, "isFinished": room.isFinished}


@main.route("/me")
def index():
  user = None
  if "user_id" in session:
    user = db.session.get(User, session["user_id"])
  return jsonify({"user": {"id": user.id, "username": user.username, "email": user.email, "isTutor": user.isTutor} if user else None})


def _register_user(is_tutor):
  email = request.form.get("email", "")
  password = request.form.get("password", "")
  username = request.form.get("username", "").strip()

  if not username or not password:
    return jsonify({"error": "ユーザー名とパスワードを入力してください"}), 400

  if User.query.filter_by(username=username).first() is not None:
    return jsonify({"error": "そのユーザー名は既に使われています"}), 400

  if User.query.filter_by(email=email).first() is not None:
    return jsonify({"error": "そのメールアドレスは既に使われています"}), 400

  user = User(username=username, password=generate_password_hash(password), email=email, isTutor=is_tutor)
  db.session.add(user)
  db.session.commit()
  return jsonify({"id": user.id, "username": user.username}), 201


@main.route("/register", methods=["POST"])
def register():
  return _register_user(False)


@main.route("/register/tutor", methods=["POST"])
def register_tutor():
  return _register_user(True)


@main.route("/login", methods=["POST"])
def login():
  username = request.form.get("username", "").strip()
  password = request.form.get("password", "")

  user = User.query.filter_by(username=username).first()
  if user is None or not check_password_hash(user.password, password):
    return jsonify({"error": "ユーザー名またはパスワードが間違っています"}), 401

  session["user_id"] = user.id
  return jsonify({"id": user.id, "username": user.username})


@main.route("/logout", methods=["POST"])
def logout():
  session.pop("user_id", None)
  return jsonify({"message": "ログアウトしました"})


@main.route("/room", methods=["POST"])
@login_required
def create_room():
  name = request.form.get("name", "").strip()
  if not name:
    return jsonify({"error": "部屋名を入力してください"}), 400

  room = Room.create_room(name, session["user_id"])
  return jsonify(room_to_dict(room)), 201


@main.route("/rooms", methods=["GET", "POST"])
@login_required
def list_rooms():
  if request.method == "POST":
    data = request.get_json(silent=True) or {}
    user_id = str(data.get("user_id", "")).strip()
  else:
    user_id = request.args.get("user_id", "").strip()

  if not user_id:
    return jsonify({"error": "user_idを指定してください"}), 400

  rooms = Room.get_all_by_user_id(user_id)
  return jsonify([room_to_dict(room) for room in rooms])


@main.route('/room/<id>', methods=["GET", "POST"])
def room(id):
  room = Room.get_by_id(id)
  if room is None:
    return jsonify({"error": "部屋が見つかりません"}), 404

  if request.method == "POST":
    if session.get("user_id") != room.user_id:
      return jsonify({"error": "権限がありません"}), 403

    is_finished = request.form.get("is_finished", "").strip()
    if is_finished:
      room = Room.close_room(id)

  return jsonify(room_to_dict(room))


@main.route("/reaction/<id>", methods=["POST"])
def send_reaction(id):
  room = Room.get_by_id(id)
  if room is None:
    return jsonify({"error": "部屋が見つかりません"}), 404

  user_id = session.get("user_id")
  Reaction.create_reaction(id, user_id)
  return jsonify(room_to_dict(room)), 201


def _reactions_for_user(user_id):
  reactions = Reaction.get_all_by_user_id(user_id)
  result = []
  for reaction in reactions:
    room = Room.get_by_id(reaction.room_id)
    result.append({
      "id": reaction.id,
      "room_id": reaction.room_id,
      "room_name": room.name if room else None,
      "user_id": reaction.user_id,
    })
  return jsonify(result)


@main.route("/reactions/user/<user_id>", methods=["GET"])
@login_required
def list_user_reactions(user_id):
  return _reactions_for_user(user_id)


@main.route("/reactions/user", methods=["POST"])
@login_required
def list_user_reactions_by_body():
  data = request.get_json(silent=True) or {}
  user_id = str(data.get("user_id", "")).strip()
  if not user_id:
    return jsonify({"error": "user_idを指定してください"}), 400
  return _reactions_for_user(user_id)


@main.route("/qrcreate/<id>", methods=["GET"])
def qr(id):
  url = "http://127.0.0.1:5000/room/" + id
  if not url:
    return jsonify({"error": "url parameter is required"}), 400

  qr_code = qrcode.QRCode(
    version=None,
    error_correction=ERROR_CORRECT_H,
    box_size=10,
    border=4,
  )
  qr_code.add_data(url)
  qr_code.make(fit=True)
  img = qr_code.make_image(fill_color="black", back_color="white")

  buf = io.BytesIO()
  img.save(buf)
  buf.seek(0)
  return send_file(buf, mimetype="image/png")



# @main.route("/room_setting/<id>")
# def room_setting(id):
#   room = Room.get_by_id(id)
#   if room is None:
#     return jsonify({"error": "部屋が見つかりません"}), 404
#   return jsonify(room_to_dict(room))


# @main.route("/room_close/<id>", methods=["POST"])
# @login_required
# def room_close(id):
#   room = Room.get_by_id(id)
#   if room is None:
#     return jsonify({"error": "部屋が見つかりません"}), 404

#   if session["user_id"] != room.user_id:
#     return jsonify({"error": "権限がありません"}), 403

#   is_finished = request.form.get("is_finished", "").strip()
#   if is_finished:
#     room = Room.close_room(id)

#   return jsonify(room_to_dict(room))
