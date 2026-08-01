from flask import Blueprint, render_template


tutor_routes = Blueprint("tutor", __name__, url_prefix="/tutor")


@tutor_routes.route("/", strict_slashes=False)
def tutor_main():
  return render_template("tutor/main.html", title="講師トップ")


@tutor_routes.route("/login")
def tutor_login():
  return render_template("tutor/login.html", title="講師ログイン")


@tutor_routes.route("/room/<int:room_id>")
def tutor_room(room_id):
  return render_template(
    "tutor/room.html",
    title="ルーム管理",
    room_id=room_id,
  )
