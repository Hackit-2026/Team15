import os

from flask import Flask
from flask_migrate import Migrate

from controllers.main_controller import main
from controllers.pages_controller import pages
from controllers.presentation_controller import presentation_routes
from controllers.tutor_controller import tutor_routes
from models import db

base_dir = os.path.dirname(__file__)

app = Flask(__name__)
app.secret_key = "dev-secret-key-change-me"
app.config["APP_NAME"] = "Checkit"
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(base_dir, "data.sqlite")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
migrate = Migrate(app, db)

with app.app_context():
  db.create_all()


@app.context_processor
def inject_app_name():
  return {"app_name": app.config["APP_NAME"]}


app.register_blueprint(main)
app.register_blueprint(pages)
app.register_blueprint(presentation_routes)
app.register_blueprint(tutor_routes)

if __name__ == "__main__":
  app.run(debug=True)
