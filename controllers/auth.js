const { validationResult } = require('express-validator')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const User = require('../models/user')

exports.signup = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty) {
    const error = new Error('Validation failed!')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }
  const email = req.body.email
  const password = req.body.password
  const name = req.body.name
  try {
    const hashedPassword = await bcrypt.hash(password, 12)
    const user = new User({
      email: email,
      password: hashedPassword,
      name: name
    })
    await user.save()
    res.status(201).json({
      message: 'User created!',
      userId: user._id
    })
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500
    }
    next(err)
  }
}

exports.login = async (req, res, next) => {
  const email = req.body.email
  const password = req.body.password
  try {
    const user = await User.findOne({ email: email })
    if (!user) {
      error = new Error(
        'This email is not registered! Please enter valid email.'
      )
      error.statusCode = 422
      throw error
    }
    const isEqual = bcrypt.compare(password, user.password)
    if (!isEqual) {
      error = new Error('Wrong password! Please enter correct one.')
      error.statusCode = 422
      throw error
    }
    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id.toString()
      },
      'dontmesswiththejsonwebtoken',
      {
        expiresIn: '1h'
      }
    )
    res.status(200).json({
      token: token,
      userId: user._id.toString()
    })
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500
    }
    next(err)
  }
}

exports.getStatus = async (req, res, next) => {
  const userId = req.userId
  try {
    const user = await User.findById(userId)
    if (!user) {
      error = new Error('User not found!')
      error.statusCode = 404
      throw err
    }
    res.status(200).json({
      message: 'Status fetched successfully!',
      status: user.status
    })
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500
    }
    next(err)
  }
}

exports.updateStatus = async (req, res, next) => {
  errors = validationResult(req)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed!')
    error.statusCode = 422
    throw error
  }
  const status = req.body.status
  if (!status) {
    error = new Error('Status not received!')
    error.statusCode = 404
    throw error
  }
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      error = new Error('User not found!')
      error.statusCode = 404
      throw err
    }
    user.status = status
    await user.save()
    res.status(200).json({
      message: 'User status updated!'
    })
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500
    }
    next(err)
  }
}
