# model.py
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


# モデルクラスの定義にはdb.Modelクラスを継承する必要がある。
class User(db.Model):
  # テーブル名を設定(テーブル名はクラス名の複数形が一般的)
  __tablename__ = 'users'

  # 作成するテーブルのカラムを定義
  id = db.Column(db.Integer, primary_key=True)
  email = db.Column(db.Text)
  password = db.Column(db.Text, nullable=False)
  username = db.Column(db.Text, unique=True, nullable=False)
  isTutor = db.Column(db.Boolean, default=False)


class Room(db.Model):
  __tablename__ = 'rooms'

  id = db.Column(db.Integer, primary_key=True)
  name = db.Column(db.Text, nullable=False)
  user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
  isFinished = db.Column(db.Boolean, default=False)
  user = db.relationship("User", backref="rooms")

  @classmethod
  def get_by_id(cls, room_id):
    return db.session.get(cls, room_id)

  @classmethod
  def create_room(cls, name, user_id):
    room = Room(name=name, user_id=user_id)
    db.session.add(room)
    db.session.commit()
    return room


  @classmethod
  def close_room(cls, room_id):
    room = db.session.get(Room, room_id)
    if room is None:
      return None
    room.isFinished = True
    db.session.commit()
    return room


class Reaction(db.Model):
  __tablename__ = 'reactions'
  
  id = db.Column(db.Integer, primary_key=True)
  room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False)
  user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
  user = db.relationship("User", backref="reactions")


  @classmethod
  def get_by_id(cls, reaction_id):
    return db.session.get(cls, reaction_id)

  @classmethod
  def get_all_by_room_id(cls, room_id):
    return cls.query.filter_by(room_id=room_id).all()

  @classmethod
  def get_all_by_user_id(cls, user_id):
    return cls.query.filter_by(user_id=user_id).all()
  
  @classmethod
  def create_reaction(cls, room_id, user_id):
    reaction = Reaction(room_id=room_id, user_id=user_id)
    db.session.add(reaction)
    db.session.commit()
    return reaction

