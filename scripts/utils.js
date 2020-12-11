function convertDateToISO(dateString){
    const d = new Date(dateString);
    let isoDateString = d.toISOString();
    isoDateString = isoDateString.slice(0, 10);
    return isoDateString;
}

function convertDateFromISOToGS1Format(isoDateString){
    const date = new Date(isoDateString);
    const ye = new Intl.DateTimeFormat('en', {year: '2-digit'}).format(date);
    const mo = new Intl.DateTimeFormat('en', {month: '2-digit'}).format(date);
    const da = new Intl.DateTimeFormat('en', {day: '2-digit'}).format(date);
    return `${ye}${mo}${da}`;
}


function convertDateTOGMTFormat(date){
    let formatter = new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        weekday: "short",
        monthday: "short",
        timeZone: 'GMT'
    });

    let arr = formatter.formatToParts(date);
    let no = {};
    arr.forEach( item =>{
        no[item.type] = item.value;
    })
    let {year, month, day, hour, minute } = no;

    let offset = -date.getTimezoneOffset();
    let offset_min = offset % 60;
    if(!offset_min){
        offset_min = "00"
    }
    offset = offset / 60;
    let offsetStr = "GMT ";
    if(offset){
        if(offset >0){
            offsetStr+= "+";
        }
        offsetStr+=offset;
        offsetStr+=":";
        offsetStr+=offset_min;
    }

    return `${year} ${month} ${day} ${hour}:${minute} ${offsetStr}`;
}


export default {
    convertDateFromISOToGS1Format,
    convertDateToISO,
    convertDateTOGMTFormat
}