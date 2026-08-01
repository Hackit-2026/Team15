from functools import wraps

from flask import Blueprint, flash, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from models import User, Room, Reaction, db

main = Blueprint('main', __name__)


def login_required(view):
  @wraps(view)
  def wrapped_view(*args, **kwargs):
    if "user_id" not in session:
      flash("ログインしてください")
      return redirect(url_for("main.login"))
    return view(*args, **kwargs)

  return wrapped_view


@main.route("/")
def index():
  user = None
  if "user_id" in session:
    user = db.session.get(User, session["user_id"])
  return render_template("index.html", title="トップページ", user=user)


@main.route("/register", methods=["GET", "POST"])
def register():
  if request.method == "POST":
    email = request.form.get("email", "")
    password = request.form.get("password", "")
    username = request.form.get("username", "").strip()

    if not username or not password:
      flash("ユーザー名とパスワードを入力してください")
      return render_template("register.html")

    if User.query.filter_by(username=username).first() is not None:
      flash("そのユーザー名は既に使われています")
      return render_template("register.html")
    
    if User.query.filter_by(email=email).first() is not None:
      flash("そのユーザー名は既に使われています")
      return render_template("register.html")

    user = User(username=username, password=generate_password_hash(password), email=email)
    db.session.add(user)
    db.session.commit()
    flash("登録が完了しました。ログインしてください")
    return redirect(url_for("main.login"))

  return render_template("register.html")


@main.route("/login", methods=["GET", "POST"])
def login():
  if request.method == "POST":
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")

    user = User.query.filter_by(username=username).first()
    if user is None or not check_password_hash(user.password, password):
      flash("ユーザー名またはパスワードが間違っています")
      return render_template("login.html")

    session["user_id"] = user.id
    flash(f"{user.username} さん、ようこそ")
    return redirect(url_for("main.index"))

  return render_template("login.html")


@main.route("/logout")
def logout():
  session.pop("user_id", None)
  flash("ログアウトしました")
  return redirect(url_for("main.index"))


@main.route("/mypage")
@login_required
def mypage():
  user = db.session.get(User, session["user_id"])
  return render_template("mypage.html", user=user)


@main.route("/room", methods=["GET", "POST"])
@login_required
def create_room():
  if request.method == "POST":
    name = request.form.get("name", "").strip()
    if not name:
      flash("部屋名を入力してください")
      return redirect(url_for("main.index"))
    room = Room(name=name, user_id=session["user_id"])
    db.session.add(room)
    db.session.commit()
    flash(f"「{room.name}」を作成しました")
  return render_template("create_room.html")


@main.route('/room/<id>', methods=["GET", "POST"])
def room(id):
  if request.method == "POST":
    isFnished = request.form.get("is_finished", "").strip()
    if isFnished:
      Room.close_room(id)
    return render_template('room_setting.html', room=room)
  elif request.method == "GET":
    room = Room.get_by_id(id)
  return render_template('room.html', room=room)


@main.route("/reaction/<id>", methods=["POST"])
def send_reaction(id):
  Reaction.create_reaction(id)
  room = Room.get_by_id(id)
  return render_template('room.html', room=room)


@main.route("/room_setting/<id>", methods=["GET"])
def room_setting(id):
  room = Room.get_by_id(id)
  return render_template('room_setting.html', room=room)


@main.route("/room_close/<id>", methods=["POST"])
def room_close(id):
  room = Room.get_by_id(id)
  isFnished = request.form.get("is_finished", "").strip()
  if isFnished:
    Room.close_room(id)
  return render_template('room_setting.html', room=room)