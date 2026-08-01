import os

from flask import Flask
from flask_migrate import Migrate

from controllers.main_controller import main
from controllers.pages_controller import pages
from models import db

base_dir = os.path.dirname(__file__)

app = Flask(__name__)
app.secret_key = "dev-secret-key-change-me"

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(base_dir, "data.sqlite")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
migrate = Migrate(app, db)

with app.app_context():
  db.create_all()

app.register_blueprint(main)
app.register_blueprint(pages)

if __name__ == "__main__":
  app.run(debug=True)
