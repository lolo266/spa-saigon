const httpStatus = require("http-status");
const Ledger = require("../models/ledger.model");
const Shift = require("../models/shift.model");
const APIError = require("../utils/APIError");
const moment = require('moment');
/**
 * Load ledger and append to req.
 * @public
 */
exports.load = async (req, res, next, id) => {
  try {
    const ledger = await Ledger.get(id);
    req.locals = { ledger };
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Get ledger
 * @public
 */
exports.get = (req, res) => res.json(req.locals.ledger.transform());

/**
 * Create new ledger
 * @public
 */
exports.create = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.body.shift);
    if (!shift) {
      throw new APIError({
        message: "Ca hiện tại không hợp lệ",
        status: httpStatus.BAD_REQUEST
      });
    }
    if (shift && shift.lock) {
      throw new APIError({
        message: "Ca hiện tại đã đóng, vui lòng mở Ca để chỉnh sửa",
        status: httpStatus.BAD_REQUEST
      });
    }
    const ledger = new Ledger({ ...req.body, createdBy: req.user.id });
    let savedLedger = await ledger.save();
    savedLedger = await savedLedger
      .populate("staff", "name")
      .populate("createdBy", "username")
      .execPopulate();
    res.status(httpStatus.CREATED);
    res.json(savedLedger.transform());
  } catch (error) {
    next(error);
  }
};

/**
 * Update existing ledger
 * @public
 */
exports.update = (req, res, next) => {
  if (req.locals.ledger.shift.lock) {
    throw new APIError({
      message: "Ca hiện tại đã đóng, vui lòng mở Ca để thêm mới.",
      status: httpStatus.BAD_REQUEST
    });
  }
  const ledger = Object.assign(req.locals.ledger, req.body);
  ledger
    .save()
    .then(savedLedger =>
      savedLedger
        .populate("staff", "name")
        .populate("createdBy", "username")
        .execPopulate()
    )
    .then(savedLedger => res.json(savedLedger.transform()))
    .catch(e => next(Ledger.checkDuplicateLedgername(e)));
};

/**
 * Get ledger list
 * @public
 */
exports.list = async (req, res, next) => {
  try {
    const ledgers = await Ledger.list(req.query);
    const transformedLedgers = ledgers.map(ledger => ledger.transform());
    res.json(transformedLedgers);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete ledger
 * @public
 */
exports.remove = (req, res, next) => {
  if (req.locals.ledger.shift.lock) {
    throw new APIError({
      message: "Ca hiện tại đã đóng, vui lòng mở Ca để xóa",
      status: httpStatus.BAD_REQUEST
    });
  }
  const ledger = req.locals.ledger;

  ledger
    .remove()
    .then(savedLedger => res.json(savedLedger.transform()))
    .catch(e => next(e));
};

exports.report = async (req, res, next) => {
  try {
    const shifts = await Shift.list(req.query);
    const shiftIds = [];
    shifts.forEach(shift => {
      shiftIds.push(shift._id);
    });
    const ledgers = await Ledger.report({ ...req.query, shiftIds });
    // const transformedLedgers = ledgers.map(ledger => ledger.transform());
    res.json(ledgers);
  } catch (error) {
    next(error);
  }
};

exports.info = async (req, res, next) => {
  try {

    let date = Number(req.query.date);
    const shift = await Shift.findOne({
      $and: [
        {
          date: {
            $gte: moment(date)
              .startOf("day")
              .toDate(),
            $lte: moment(date)
              .endOf("day")
              .toDate()
          }
        },
        { branch: req.query.branch }
      ]
    }).exec();
    if(!shift){
      throw new APIError({
        message: "Không có dữ liệu",
        status: httpStatus.BAD_REQUEST
      });
    }
    const ledgers = await Ledger.find({ shift: shift.id }).populate("staff", "name");
    if (!ledgers) {
      throw new APIError({
        message: "Không có dữ liệu",
        status: httpStatus.BAD_REQUEST
      });
    }
    // const transformedLedgers = ledgers.map(ledger => ledger.transform());
    res.json(ledgers);
  } catch (error) {
    next(error);
  }
};
