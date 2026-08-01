from flask import Flask, render_template, Blueprint

app = Flask(__name__)
app.config["app_name"] = "サンプルアプリ名"

tutor_routes = Blueprint("tutor", __name__, url_prefix="/tutor")

@app.context_processor
def inject_app_name():
    return {
        "app_name": app.config["app_name"]
    }


@app.route("/")
def index():
  return render_template("index.html", title="トップページ")



# tutor_routes

@tutor_routes.route("/")
def tutor_main():
  return render_template("tutor/main.html", title="講師トップ")

@tutor_routes.route("/login")
def tutor_login():
  return render_template("tutor/login.html", title="講師ログイン")




app.register_blueprint(tutor_routes)
if __name__ == "__main__":
  app.run(debug=True)
