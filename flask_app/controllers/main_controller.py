from functools import wraps

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from models import Reaction, Room, User, db

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


@main.route("/")
def index():
  user = None
  if "user_id" in session:
    user = db.session.get(User, session["user_id"])
  return jsonify({"user": {"id": user.id, "username": user.username} if user else None})


@main.route("/register", methods=["POST"])
def register():
  email = request.form.get("email", "")
  password = request.form.get("password", "")
  username = request.form.get("username", "").strip()

  if not username or not password:
    return jsonify({"error": "ユーザー名とパスワードを入力してください"}), 400

  if User.query.filter_by(username=username).first() is not None:
    return jsonify({"error": "そのユーザー名は既に使われています"}), 400

  if User.query.filter_by(email=email).first() is not None:
    return jsonify({"error": "そのメールアドレスは既に使われています"}), 400

  user = User(username=username, password=generate_password_hash(password), email=email)
  db.session.add(user)
  db.session.commit()
  return jsonify({"id": user.id, "username": user.username}), 201


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


@main.route("/mypage")
@login_required
def mypage():
  user = db.session.get(User, session["user_id"])
  return jsonify({"id": user.id, "username": user.username, "email": user.email})


@main.route("/room", methods=["POST"])
@login_required
def create_room():
  name = request.form.get("name", "").strip()
  if not name:
    return jsonify({"error": "部屋名を入力してください"}), 400

  room = Room.create_room(name, session["user_id"])
  return jsonify(room_to_dict(room)), 201


@main.route('/room/<id>', methods=["GET", "POST"])
def room(id):
  room = Room.get_by_id(id)
  if room is None:
    return jsonify({"error": "部屋が見つかりません"}), 404

  if request.method == "POST":
    is_finished = request.form.get("is_finished", "").strip()
    if is_finished:
      room = Room.close_room(id)

  return jsonify(room_to_dict(room))


@main.route("/reaction/<id>", methods=["POST"])
def send_reaction(id):
  room = Room.get_by_id(id)
  if room is None:
    return jsonify({"error": "部屋が見つかりません"}), 404

  Reaction.create_reaction(id)
  return jsonify(room_to_dict(room)), 201


@main.route("/room_setting/<id>")
def room_setting(id):
  room = Room.get_by_id(id)
  if room is None:
    return jsonify({"error": "部屋が見つかりません"}), 404
  return jsonify(room_to_dict(room))


@main.route("/room_close/<id>", methods=["POST"])
def room_close(id):
  room = Room.get_by_id(id)
  if room is None:
    return jsonify({"error": "部屋が見つかりません"}), 404

  is_finished = request.form.get("is_finished", "").strip()
  if is_finished:
    room = Room.close_room(id)

  return jsonify(room_to_dict(room))
