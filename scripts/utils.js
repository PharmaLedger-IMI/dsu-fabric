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

export default {
    convertDateFromISOToGS1Format,
    convertDateToISO
}