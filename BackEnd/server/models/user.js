
var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Plane = require('./plane.js');
const { ObjectID } = require('mongodb');

var UserSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  planes: [Plane],
  tokens: [{
    access: {
      type: String,
      required: true
    },
    token: {
      type: String,
      required: true
    }
  }]
});

UserSchema.pre('save', function (next) {
  var user = this;
  if (user.isModified('password')) {
    bcrypt.hash(user.password, 4, (err, hash) => {
      if (err) {
        return next(err);
      }
      user.password = hash;
      next();
    });
  } else {
    next();
  }
});

UserSchema.statics.findByCredentials = function (username, password) {
  var User = this;

  return User.findOne({ username }).then((user) => {
    if (!user) {
      return Promise.reject('There is no such user in the system');
    }

    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, res) => {
        if (res) {
          resolve(user);
        } else {
          reject('Incorrect password');
        }
      });
    });
  });
};

UserSchema.methods.generateAuthToken = function () {
  const user = this;
  const access = 'auth';
  const token = jwt.sign({ _id: user._id.toHexString(), access }, 'abc123').toString();
  user.tokens.push({ access, token });

  return user.save().then(() => {
    return token;
  });
};

UserSchema.statics.findByToken = function (token) {
  var User = this;
  var decoded;

  try {
    decoded = jwt.verify(token, 'abc123');
  } catch (e) {
    return Promise.reject();
  }

  return User.findOne({
    '_id': decoded._id,
    'tokens.token': token,
    'tokens.access': 'auth'
  });
};

UserSchema.methods.removeToken = function (token) {
  const user = this;
  return user.update({
    $pull: {
      tokens: { token }
    }
  });
};

UserSchema.methods.addIcaoNumber = function (planeObj) {
  const user = this;
  let isIcaoAlreadyExist = false;
  user.planes.forEach(planeInTheList => {
    if (planeInTheList.icao == planeObj.icao) {
      isIcaoAlreadyExist = true;
      return;
    }
  });
  if (!isIcaoAlreadyExist) {
    user.planes.push(planeObj);
    return user.save().then(() => {
      return user.planes.slice(-1)[0]._id.toHexString();
    });
  } else {
    return Promise.reject('This icao number already existis');
  };
};

UserSchema.methods.deleteIcaoNumber = function (icao) {
  const user = this;
  return user.update({
    $pull: {
      planes: { icao }
    }
  });
};

UserSchema.statics.isUserExist = async function (username) {
  const user = await User.find(
    { username }
  );
  return user.length !== 0
};

UserSchema.statics.getIcaoByPlaneID = async function (planeID) {
  const userPlanesList = await this.find(
    {
      planes:
        {
          $elemMatch:
            { _id: ObjectID(planeID) }
        }
    },
    { planes: 1 });
  for (const plane of userPlanesList[0].planes) {
    if (plane._id == planeID) {
      return plane.icao;
    }
  }
};

UserSchema.statics.getIcaoList = function (username) {
  const User = this;
  return User.findOne({ username }).then(user => {
    const icaoList_formatted = [];
    for (const planeObj of user.planes) {
      icaoList_formatted.push(planeObj);
    };
    return icaoList_formatted;
  })
};

const User = mongoose.model('User', UserSchema);
module.exports = User;