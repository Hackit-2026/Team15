from flask import Blueprint, render_template

pages = Blueprint('pages', __name__)


@pages.route("/")
def index():
  return render_template("index.html")


@pages.route("/login")
def login():
  return render_template("login.html")


@pages.route("/register")
def register():
  return render_template("register.html")


@pages.route("/mypage")
def mypage():
  return render_template("mypage.html")


@pages.route("/room/new")
def create_room():
  return render_template("create_room.html")


@pages.route("/room/<id>")
def room(id):
  return render_template("room.html", room_id=id)


@pages.route("/room_setting/<id>")
def room_setting(id):
  return render_template("room_setting.html", room_id=id)
