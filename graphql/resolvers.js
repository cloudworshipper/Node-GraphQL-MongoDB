const fs = require('fs')
const path = require('path')

const bcrypt = require('bcryptjs')
const validator = require('validator')
const jwt = require('jsonwebtoken')

const User = require('../models/user')
const Post = require('../models/post')

module.exports = {
  createUser: async function ({ userInput }, req) {
    // const email = args.userInput.email
    const errors = []
    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: 'Invalid email!' })
    }
    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: 'Password doesnot meet minimum length criteria!' })
    }
    const existingUser = await User.findOne({ email: userInput.email })
    if (existingUser) {
      errors.push({ message: 'User exists already!' })
    }
    if (errors.length > 0) {
      const error = new Error('Invalid inputs!')
      error.data = errors
      error.code = 422
      throw error
    }
    const hashedPassword = await bcrypt.hash(userInput.password, 12)
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPassword
    })
    const createdUser = await user.save()
    return { ...createdUser._doc, _id: createdUser._id.toString() }
  },
  login: async function ({ email, password }) {
    if (!validator.isEmail(email)) {
      const error = new Error('Invalid email!')
      error.code = 401
      throw error
    }
    if (
      validator.isEmpty(password) ||
      !validator.isLength(password, { min: 5 })
    ) {
      const error = new Error('Invalid password!')
      error.code = 401
      throw error
    }
    const user = await User.findOne({ email: email })
    if (!user) {
      const error = new Error('User doesnot exist!')
      error.code = 401
      throw error
    }
    const isEqual = await bcrypt.compare(password, user.password)
    if (!isEqual) {
      const error = new Error('Incorrect password!')
      error.code = 401
      throw error
    }
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      'dontmesswithjsonwebtoken',
      { expiresIn: '1h' }
    )
    return { token: token, userId: user._id.toString() }
  },
  createPost: async function ({ postInput }, req) {
    if (!req.isAuth) {
      const error = new Error('User not authenticated!')
      error.code = 401
      throw error
    }
    const errors = []
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: 'Invalid title!' })
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: 'Invalid content!' })
    }
    if (errors.length > 0) {
      const error = new Error('Invalid inputs!')
      error.data = errors
      error.code = 422
      throw error
    }
    const user = await User.findById(req.userId)
    if (!user) {
      const error = new Error('Invalid user!')
      error.code = 401
      throw error
    }
    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user
    })
    const createdPost = await post.save()
    user.posts.push(createdPost)
    await user.save()
    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString()
    }
  },
  posts: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error('User not authenticated!')
      error.code = 401
      throw error
    }
    if (!page) {
      page = 1
    }
    const perPage = 2
    const totalPosts = await Post.find().countDocuments()
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate('creator')
    return {
      posts: posts.map(p => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        }
      }),
      totalPosts: totalPosts
    }
  },
  post: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error('User not authenticated!')
      error.code = 401
      throw error
    }
    if (!id) {
      const error = new Error('Invalid post Id!')
      error.code = 422
      throw error
    }
    const post = await Post.findById(id).populate('creator')
    if (!post) {
      const error = new Error('No post found!')
      error.code = 401
      throw error
    }
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString()
    }
  },
  updatePost: async function ({ id, postInput }, req) {
    if (!req.isAuth) {
      const error = new Error('User not authenticated!')
      error.code = 401
      throw error
    }
    const errors = []
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: 'Invalid title!' })
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: 'Invalid content!' })
    }
    if (errors.length > 0) {
      const error = new Error('Invalid inputs!')
      error.data = errors
      error.code = 422
      throw error
    }
    const post = await Post.findById(id).populate('creator')
    if (post.creator._id.toString() !== req.userId.toString()) {
      error = new Error('Not authorized!')
      error.code = 401
      throw error
    }
    post.title = postInput.title
    post.content = postInput.content
    if (postInput.imageUrl !== 'undefined') {
      post.imageUrl = postInput.imageUrl
    }
    const updatedPost = await post.save()
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString()
    }
  },
  deletePost: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error('User not authenticated!')
      error.code = 401
      throw error
    }
    if (!id) {
      const error = new Error('Invalid post Id!')
      error.code = 422
      throw error
    }
    const post = await Post.findById(id).populate('creator')
    if (!post) {
      error = new Error('Post not found!')
      error.code = 404
      throw error
    }
    if (post.creator._id.toString() !== req.userId.toString()) {
      error = new Error('Not authorized!')
      error.code = 401
      throw error
    }
    clearImage(post.imageUrl)
    await Post.findByIdAndRemove(id)
    const user = await User.findById(req.userId)
    await user.posts.pull(id)
    await user.save()

    return { message: 'Post deleted!' }
  },
  status: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error('User not authenticated!')
      error.code = 401
      throw error
    }
    const user = await User.findById(req.userId)
    if (!user) {
      error = new Error('User not found!')
      error.statusCode = 404
      throw err
    }
    if (status) {
      user.status = status
      await user.save()
      return true
    }
    return {
      ...user._doc,
      _id: user._id.toString()
    }
  }
}

const clearImage = filePath => {
  const imagePath = path.join(__dirname, '..', filePath)
  fs.unlink(imagePath, err => {
    console.log(err)
  })
}
