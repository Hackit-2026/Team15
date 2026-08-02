# model.py
from datetime import datetime, timezone

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
    if room.presentation is not None and room.presentation.status != "ended":
      room.presentation.status = "ended"
      room.presentation.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return room

  @classmethod
  def get_all_by_user_id(cls, user_id):
    return cls.query.filter_by(user_id=user_id).all()


class Presentation(db.Model):
  __tablename__ = 'presentations'
  __table_args__ = (
    db.CheckConstraint('current_page >= 1', name='ck_presentations_current_page_min'),
    db.CheckConstraint('total_pages >= 1', name='ck_presentations_total_pages_min'),
    db.CheckConstraint('current_page <= total_pages', name='ck_presentations_current_page_max'),
    db.CheckConstraint('file_size > 0', name='ck_presentations_file_size_positive'),
  )

  STATUS_READY = 'ready'
  STATUS_PRESENTING = 'presenting'
  STATUS_ENDED = 'ended'

  id = db.Column(db.Integer, primary_key=True)
  room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False, unique=True)
  original_filename = db.Column(db.Text, nullable=False)
  storage_key = db.Column(db.Text, nullable=False, unique=True)
  content_type = db.Column(db.Text, nullable=False)
  file_size = db.Column(db.Integer, nullable=False)
  total_pages = db.Column(db.Integer, nullable=False)
  current_page = db.Column(db.Integer, nullable=False, default=1)
  status = db.Column(db.String(20), nullable=False, default=STATUS_READY)
  created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
  updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
  room = db.relationship("Room", backref=db.backref("presentation", uselist=False))

  @classmethod
  def get_by_id(cls, presentation_id):
    return db.session.get(cls, presentation_id)

  @classmethod
  def get_by_room_id(cls, room_id):
    return cls.query.filter_by(room_id=room_id).first()

  @classmethod
  def create(cls, room_id, original_filename, storage_key, content_type, file_size, total_pages):
    presentation = cls(
      room_id=room_id,
      original_filename=original_filename,
      storage_key=storage_key,
      content_type=content_type,
      file_size=file_size,
      total_pages=total_pages,
      current_page=1,
      status=cls.STATUS_READY,
    )
    db.session.add(presentation)
    db.session.commit()
    return presentation

  def replace_file(self, original_filename, storage_key, content_type, file_size, total_pages):
    self.original_filename = original_filename
    self.storage_key = storage_key
    self.content_type = content_type
    self.file_size = file_size
    self.total_pages = total_pages
    self.current_page = 1
    self.status = self.STATUS_READY
    db.session.commit()
    return self

  def update_current_page(self, current_page):
    self.current_page = current_page
    db.session.commit()
    return self

  def set_status(self, status):
    self.status = status
    db.session.commit()
    return self

  def delete(self):
    db.session.delete(self)
    db.session.commit()


class Reaction(db.Model):
  __tablename__ = 'reactions'
  
  id = db.Column(db.Integer, primary_key=True)
  room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False)
  user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
  timestamp = db.Column(db.DateTime, default=datetime.now)
  page = db.Column(db.Integer, nullable=True)
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
    presentation = Presentation.get_by_room_id(room_id)
    page = presentation.current_page if presentation is not None else None
    
    reaction = Reaction(room_id=room_id, user_id=user_id, page=page)
    db.session.add(reaction)
    db.session.commit()
    return reaction

