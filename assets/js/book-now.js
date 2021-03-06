var venues = [];
var currentVenue = {};
var currentProduct = {};
var submitted = false;


function fillVenues(){
  for (var i = 0; i < venues.length; i++) {
    $("#selectVenue").append($("<option>", {
      text : venues[i].name,
      value : venues[i]._id,
    }));
  }
}

function updateWithVenue(venueID){
  for (var i = 0; i < venues.length; i++) {
    if (venueID == venues[i]._id) {
      currentVenue = venues[i];
    }
  };
  $("#selectProduct").empty();
  for (var i = 0; i < currentVenue.products.length; i++) {
    $("#selectProduct").append($("<option>", {
        text : currentVenue.products[i].name,
        value : currentVenue.products[i].id,
    }));
  }
}

function getStartTimes(date, length) {
  const day = moment(date).format("dddd").toLowerCase();
  var out = []

  var startTime = moment(moment(date).format("YYYY-MM-DD") + "T" + currentVenue.opening_hours[day].open);
  var endTime = moment(moment(date).format("YYYY-MM-DD") + "T" + currentVenue.opening_hours[day].close).subtract(length, "hours");

  while (startTime.isSameOrBefore(endTime)) {
    out.push(moment(startTime));
    startTime.add(30, 'minutes');
  }
  return out;
}

function bestRate(product, hours) {
  var full_price = product.price_per_hour * hours;
  if (3 < hours && hours <= 7 && product.price_full_day && product.price_full_day < full_price) {
    return "full_day";
  }
  if (1 < hours && hours <= 3 && product.price_half_day && product.price_half_day < full_price) {
    return "half_day";
  }
  return "hour";
}

function calculatePrice() {
  var duration = +$("#selectTime").val();
  var price = currentProduct.price_per_hour * duration;
  switch (bestRate(currentProduct, duration)) {
    case "full_day": price = currentProduct.price_full_day; break;
    case "half_day": price = currentProduct.price_half_day; break;
  }
  return price;
}

function getAvailableTimes(venueID, productID, length) {
  $.get("/api/booking/taken/" + venueID + "/" + productID, {}, function(dates) {
    $("#selectTimeStart").empty();
    var startTimes = getStartTimes($("#selectDate").val(), length);
    for (var i = 0; i < startTimes.length; i++) {
      var startTime = startTimes[i];
      // check if this booking is in the future
      var applicable = moment(startTime).isAfter(moment());
      for (var j = 0; j < dates.length; j++) {
        var reservationStart = moment(dates[j][0]);
        var reservationEnd   = moment(dates[j][1]);
        var endTime = moment(startTime).add(length, "hours");
        if (!(startTime.isSameOrAfter(reservationEnd) || endTime.isSameOrBefore(reservationStart))) {
          applicable = false;
        }
      }
      if (applicable) {
        $("#selectTimeStart").append(
          $("<option />")
            .attr("value",startTime.format("YYYY-MM-DDTHH-mm"))
            .text(startTime.format("HH:mm"))
        );
      }
    }
  });
}

function change_venue() {
  updateWithVenue($("#selectVenue option:selected").val());
  $("#selectProduct").trigger("change");
  $("#priceTag").text("£" + calculatePrice().toFixed(2));
}

function change_product() {
  for (var i = 0; i < currentVenue.products.length; i++){
    var product = currentVenue.products[i];
    if ($("#selectProduct option:selected").val() === product.id) {
      currentProduct = product;
    }
  }
  getAvailableTimes(currentVenue._id, currentProduct.id, $("#selectTime").val());
  $("#priceTag").text("£" + calculatePrice().toFixed(2));
}

$(document).ready(function(){
  $.get("api/booking/", {}, function(data){
    venues = data;
    fillVenues();
    loadFromLocalStorage();
  });

  $("#selectDate").val(moment().format("YYYY-MM-DD"));
  $("#selectDate").attr("min", moment().format("YYYY-MM-DD"));
  $("#selectDate").attr("max", moment().add(31, "days").format("YYYY-MM-DD"));


  $("#selectVenue").change(change_venue);
  $("#selectProduct").change(change_product);

  $("#selectTime").change( function(){
    if ($("#selectTime").val() > 7) {
      $("#selectTime").val("07:00");
    } else {
      getAvailableTimes(currentVenue._id, currentProduct.id, $("#selectTime").val());
      $("#priceTag").text("£" + calculatePrice().toFixed(2));
    };
  });

  $("#selectDate").change( function(){
    getAvailableTimes(currentVenue._id, currentProduct.id, $("#selectTime").val());
  });

  $("#formBookNow").submit( function(event) {
    event.preventDefault();
    saveToLocalStorage();
    if (window.submitted) {
      return;
    }
    const startDate = $("#selectTimeStart option:selected").val();
    var endDate = moment(startDate);
    endDate.add($("#selectTime").val(), "hours");
    endDate = endDate.format("YYYY-MM-DDTHH-mm");

    $.post("/api/booking/" + currentVenue._id + "/" + currentProduct.id, {
      "start":startDate,
      "end":endDate,
      "name":$("#inputName").val(),
      "phone_number":$("#inputPhone").val(),
      "email":$("#inputEmail").val(),
    }, function(data){
      window.location.assign(data.redirect);
    }).fail(function() {
      window.submitted = false;
      $("#submission-alert-fail").fadeIn(100);
      $("#submitBooking").fadeIn();
    });

    window.submitted = true;
    $("#submission-alert-fail").fadeOut();
    $("#submission-alert").fadeIn(100);
    $("#submitBooking").fadeOut();
  });
});


function saveToLocalStorage() {
    localStorage.setItem('book-now.name',     $('#inputName').val());
    localStorage.setItem('book-now.phone',    $('#inputPhone').val());
    localStorage.setItem('book-now.email',    $('#inputEmail').val());
    localStorage.setItem('book-now.venue',    currentVenue._id);
    localStorage.setItem('book-now.product',  currentProduct.id);
    localStorage.setItem('book-now.date',     $('#selectDate').val());
}


function loadFromLocalStorage() {
    var name     = localStorage.getItem('book-now.name');
    var phone    = localStorage.getItem('book-now.phone');
    var email    = localStorage.getItem('book-now.email');
    var venue    = localStorage.getItem('book-now.venue');
    var product  = localStorage.getItem('book-now.product');
    var date     = localStorage.getItem('book-now.date');

    if (name && name.length > 0)  $('#inputName').val(name);
    if (phone && phone.length > 0) $('#inputPhone').val(phone);
    if (email && email.length > 0) $('#inputEmail').val(email);
    if (venue && venue.length > 0) {
        $('#selectVenue').val(venue);
        change_venue();
        if (product && product.length > 0) {
            $('#selectProduct').val(product);
            change_product();
            if (date && date.length > 0) {
                $('#selectDate').val(date);
            }
        }
    }
}
