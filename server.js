const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const mongoose = require('mongoose')

const User = require('./models/user')
const Exercise = require('./models/exercise')

mongoose.connect(
    process.env.MLAB_URI,
    { useNewUrlParser: true }
)

app.use(cors())

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(express.static('public'))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
})

// 1. I can create a user by posting form data username to /api/exercise/new-user and returned will be an object with username and _id.
app.post('/api/exercise/new-user', (req, res) => {
    const username = req.body.username

    if (username === '' || username.length < 1) {
        res.status(400).send('Invalid username')
    } else {
        const newUser = new User({
            username,
        })

        newUser.save((err, data) => {
            if (err) {
                if (err.code === 11000) {
                    res.send('Cannot save duplicate user')
                } else {
                    res.send('Error saving new user: \n' + err)
                }
            } else {
                res.json(data)
            }
        })
    }
})

// 2. I can get an array of all users by getting api/exercise/users with the same info as when creating a user.
app.get('/api/exercise/new-user', (req, res) => {
    User.find({}, (err, users) => {
        res.send(users)
    })
})

// 3. I can add an exercise to any user by posting form data userId(_id), description, duration, and optionally date to /api/exercise/add. If no date supplied it will use current date. Returned will the the user object with also with the exercise fields added.
app.post('/api/exercise/add', (req, res) => {
    const { userId: username, description, duration } = req.body
    const date = req.body.date

    if (!username || !description || !duration) {
        res.status(400).send('Fill in all the required(*) fields.')
    } else if (isNaN(duration)) {
        res.status(400).send('Duration must be a number.')
    } else if (date !== '' && isNaN(Date.parse(date))) {
        res.status(400).send('Invalid date.')
    } else {
        // Find username
        User.findOne({ username }, (err, user) => {
            if (err) {
                res.send('Error finding user.')
            } else if (!user) {
                res.send('Username not found.')
            } else {
                let newDate

                if (date === '') {
                    newDate = new Date()
                } else {
                    newDate = Date.parse(date)
                }

                const newExercise = new Exercise({
                    userId: user.id,
                    description,
                    duration: Number(duration),
                    date: newDate,
                })

                newExercise.save((err, data) => {
                    if (err) {
                        res.send('Error saving exercise.')
                    } else {
                        res.json(data)
                    }
                })
            }
        })
    }
})

// 4. I can retrieve a full exercise log of any user by getting /api/exercise/log with a parameter of userId(_id). Return will be the user object with added array log and count (total exercise count).
// 5. I can retrieve part of the log of any user by also passing along optional parameters of from & to or limit. (Date format yyyy-mm-dd, limit = int)
// EXAMPLE: GET /api/exercise/log?{userId}[&from][&to][&limit]
app.get('/api/exercise/log', (req, res) => {
    const { userId, from, to, limit } = req.query
    const query = {}

    // Find user
    User.findOne({ username: userId }, (err, user) => {
        if (err) {
            res.send('Could not find username.')
        } else if (!user) {
            res.send('No user.')
        } else if (limit !== undefined && isNaN(limit) === true) {
            res.send('Limit is not a valid number')
        } else if (from !== undefined && isNaN(Date.parse(from)) === true) {
            res.send('From is not a valid date')
        } else if (to !== undefined && isNaN(Date.parse(to)) === true) {
            res.send('From is not a valid date')
        } else if (limit !== undefined && Number(limit) < 1) {
            res.send('Limit must be greater than 0')
        } else {
            // Create query
            query.userId = user.id

            // From
            if (from) {
                const dateFrom = new Date(from)
                query.date = { $gte: dateFrom }
            }

            // To
            if (to) {
                const dateTo = new Date(to)
                dateTo.setDate(dateTo.getDate() + 1)
                query.date = { $lt: dateTo }
            }

            // Limit
            let queryLimit
            if (limit) {
                queryLimit = Number(limit)
            }

            // Find user exercises
            Exercise.find(query)
                .select('userId description duration date')
                .limit(queryLimit)
                .exec((errExercise, exercises) => {
                    if (err) {
                        res.send(
                            'Error while searching for exercises, try again'
                        )
                    }
                    //  else if (!user) {
                    //     res.send('Exercises not found')
                    // }
                    else {
                        res.json(exercises)
                    }
                })
        }
    })
})

// Not found middleware
app.use((req, res, next) => next({ status: 404, message: 'not found' }))

// Error Handling middleware
app.use((err, req, res, next) => {
    let errCode, errMessage

    if (err.errors) {
        // mongoose validation error
        errCode = 400 // bad request
        const keys = Object.keys(err.errors)
        // report the first validation error
        errMessage = err.errors[keys[0]].message
    } else {
        // generic or custom error
        errCode = err.status || 500
        errMessage = err.message || 'Internal Server Error'
    }
    res.status(errCode)
        .type('txt')
        .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
})
