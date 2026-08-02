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


@tutor_routes.route("/room/<int:room_id>/share")
def tutor_room_share(room_id):
  return render_template(
    "tutor/share.html",
    title="参加者に共有",
    room_id=room_id,
  )


@tutor_routes.route("/room/<int:room_id>/presentation")
def tutor_room_presentation(room_id):
  return render_template(
    "tutor/presentation.html",
    title="プレゼンテーション",
    room_id=room_id,
  )
