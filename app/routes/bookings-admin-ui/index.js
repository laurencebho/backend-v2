const moment = require('moment');
const process = require('process');
const express = require('express');
const slowDown = require('express-slow-down');
const router = express.Router();
const cookieParser = require('cookie-parser');
const {Venue, Reservation} = require('../../models');
const {clientDateToMoment, StatusError, catch_errors, today} = require('../../utils');
const {addReservationEvent, deleteEvent, createCalendar} = require('../../calendarAPI');
const {needs_auth, authenticate, save_token} = require('./auth');


const IS_DEBUG = process.env.NODE_ENV === 'test';
const default_opening_hours = {
    monday:    {open: "18:00", close: "21:30"},
    tuesday:   {open: "18:00", close: "21:30"},
    wednesday: {open: "18:00", close: "21:30"},
    thursday:  {open: "18:00", close: "21:30"},
    friday:    {open: "18:00", close: "21:30"},
    saturday:  {open: "10:00", close: "16:30"},
    sunday:    {open: "10:00", close: "12:30"},
};


router.use(express.json());
router.use(cookieParser());
router.use(express.static(__dirname + '/public'));


const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 100, // allow 100 requests per 15 minutes, then...
    delayMs: 500 // begin adding 500ms of delay per request above 100
});


router.post('/auth', speedLimiter, (req, res) => {
    if (!req.body.username
        || !req.body.password
        || !authenticate(req.body.username, req.body.password)) {
        res.status(401);
        res.end();
        return;
    }
    save_token(res);
    res.json({});
    res.end();
});


const protected = express.Router();
protected.use(needs_auth);


protected.post('/venues', (req, res) => {
    // Creates a venue, need to specify req.body.name
    let venue = new Venue();
    venue.name = req.body.name;
    venue.opening_hours = default_opening_hours;
    if (IS_DEBUG) {
        venue.save().then(_ => res.json(venue));
        return;
    }
    createCalendar(venue.name).
        then(calendarId => { venue.calendarId = calendarId }).
        then(_ => venue.save()).
        then(_ => res.json(venue)).
        catch(catch_errors(res));
});


protected.get('/venues', (req, res) => {
    // Gets a list of venues
    Venue.find({}, ['name', '_id'])
        .then(docs => res.json(docs))
        .catch(catch_errors(res));
});


protected.delete('/venue/:id', (req, res) => {
    // Deletes a venue
    Venue.findByIdAndDelete(req.params.id)
        .then(res.json({}))
        .catch(catch_errors(res));
});


protected.post('/venue/:id', (req, res) => {
    // Modifies a venue.
    // req.body should be JSON, refer to app/models.js for
    // venue schema.
    Venue.findById(req.params.id)
         .then(venue => {
             if (!venue) throw new StatusError(404);
             // Should use this instead of findByIdAndUpdate because we want
             // some schema checking.
             Object.assign(venue, req.body);
             return venue.save().then(() => res.json(venue));
         })
         .catch(catch_errors(res));
});


protected.get('/venue/:id', (req, res) => {
    // Gets detail for a venue
    Venue.findById(req.params.id)
         .then(result => res.json(result))
         .catch(catch_errors(res));
});


protected.get('/venue/:id/:product_id/reservations', (req, res) => {
    // Gets a list of reservations which have not expired for
    // a given venue and product
    const order_by = (req.query.order_by ? req.query.order_by : 'created')
    Venue.findById(req.params.id).
        then(venue => {
            const product = venue.get_product(req.params.product_id);
            if (!product) throw new StatusError(404);
            return Reservation.find({
                    confirmed: true,
                    start: { $gte: today() },
                    $or: product.rooms.map(room_id => ({ 'rooms.id': room_id })),
                },
                null,
                { sort: { [order_by]: -1 } });
            }).
        then(docs => res.json(docs)).
        catch(catch_errors(res));
});


protected.post('/venue/:id/:product_id/reservations', (req, res) => {
    // Creates a reservation for a given venue and product
    // See app/models.js for schema
    const force = 'force' in req.query;
    const start = clientDateToMoment(req.body.start);
    const end   = clientDateToMoment(req.body.end);
    if (start.isAfter(end)) {
        res.status(400);
        res.end();
        return;
    }
    let venue = null;
    Venue.findById(req.params.id).
        then(_venue => {
            if (!_venue) throw new StatusError(404);
            venue = _venue;
        }).
        // force => don't need to check
        then(() => (force || venue.check_product(req.params.product_id, start, end))).
        then(can_book => {
            if (!can_book) throw new StatusError(400);
            return venue.book_product(req.params.product_id, {
                customer:  req.body.customer,
                payment:   req.body.payment,
                start:     start,
                end:       end,
                confirmed: true,
            });
        }).
        then(reservation => {
            addReservationEvent(reservation);
            res.json(reservation);
        }).
        catch(catch_errors(res));
});


protected.delete('/reservation/:id', (req, res) => {
    // Delete a reservation by id
    Reservation.findById(req.params.id).
        then(reservation => {
            if (!reservation) throw new StatusError(404);
            deleteEvent(reservation.calendarId, reservation.eventId).
                catch(() => {});
            return reservation.delete();
        }).
        then(() => res.json({})).
        catch(catch_errors(res));
});


router.use(protected);
module.exports = router;
