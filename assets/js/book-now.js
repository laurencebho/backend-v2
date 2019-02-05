var venues = [];
var currentVenue = {};
var currentProduct = {};


function fillVenues(){
  for(let i of venues){
    $("#selectVenue").append($("<option>", {
      text : i.name,
      value : i._id
    }));
  }
}

function updateWithVenue(venueID){
  for(let i of venues){
    if (venueID == i._id){
      currentVenue = i;
    };
  };
  $("#selectProduct").empty();
  for (let i of currentVenue.products){
    $("#selectProduct").append($("<option>", {
        text : i.name,
        value : i.id
    }))
  };
};

function getStartTimes(date, length){
  const day = moment(date).format("dddd").toLowerCase();
  let out = []

  let startTime = moment(moment(date).format("YYYY-MM-DD") + "T" + currentVenue.opening_hours[day].open);
  let endTime = moment(moment(date).format("YYYY-MM-DD") + "T" + currentVenue.opening_hours[day].close).subtract(length, "hours");

  while (startTime.isSameOrBefore(endTime)) {
    out.push(moment(startTime));
    startTime.add(30, 'minutes');
  };
  return out;
}

function getAvailableTimes(venueID, productID, length){
  $.get("/api/booking/taken/" + venueID + "/" + productID, {}, function(data){
    $("#selectTimeStart").empty();
    let dates = data;
    for(let startTime of getStartTimes($("#selectDate").val(), length)){
      let applicable=true;
      for(let y of dates){
        let endTime = moment(startTime).add(length, "hours");
        if (!(startTime.isSameOrAfter(moment(y[1])) || endTime.isSameOrBefore(moment(y[0])))){
          applicable=false;
        }
      }
      if(applicable){
          $("#selectTimeStart").append($("<option />").attr("value",startTime.format("YYYY-MM-DDTHH-mm")).text(startTime.format("HH:mm")))
      }
    }
  });
}

$(document).ready(function(){
  $.get("api/booking/", {}, function(data){
    venues = data;
    fillVenues();
  });

  $("#selectDate").val(moment().format("YYYY-MM-DD"));
  $("#selectTime").val(1);


  $("#selectType").change( function(){
    $("#priceTag").hide();
    $("#groupVenue").hide();
    $("#groupActivity").hide();
    $("#groupEvent").hide();
    $("#group" + $("#selectType").val()).show();
  });

  $("#selectVenue").change( function(){
    updateWithVenue($("#selectVenue option:selected").val());
    $("#selectProduct").trigger("change");
  })

  $("#selectProduct").change( function(){
    for (let i of currentVenue.products){
      if($("#selectProduct option:selected").val() == i.id){
        currentProduct = i;
      }
    }
    getAvailableTimes(currentVenue._id, currentProduct.id, $("#selectTime").val());
  });

  $("#selectTime").change( function(){
    getAvailableTimes(currentVenue._id, currentProduct.id, $("#selectTime").val());
  });

  $("#selectDate").change( function(){
    getAvailableTimes(currentVenue._id, currentProduct.id, $("#selectTime").val());
  });

  $("#formBookNow").submit( function(event){
    event.preventDefault();
    const startDate = $("#selectTimeStart option:selected").val();
    let endDate = moment(startDate);
    endDate.add($("#selectTime").val(), "hours");
    endDate = endDate.format("YYYY-MM-DDTHH-mm");
    $.post("/api/booking/" + currentVenue._id + "/" + currentProduct.id, {
      "start":startDate,
      "end":endDate,
      "name":$("#inputName").val(),
      "phone_number":$("#inputPhone").val()
    }, function(data){
      console.log(data);
    });

  })
});
