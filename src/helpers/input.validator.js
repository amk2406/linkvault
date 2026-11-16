const validator = require('validator')


const isValidEmail = (email) => {
    if (!email) return false
    return validator.isEmail(email)
}

const isValidPassword = (password, {min = null, max = null}) =>{
    if(!password || typeof password !== 'string') return false;
    let result = false
    if (min && validator.isInt(min)) {
        if (!(password.length <= min)) {
            result = false
        } else{result = true}
    }
    if (max && validator.isInt(max)) {
        if (!(password.length >= min)) {
            result = false
        } else{result = true}
    }
    return result
}

const isEqualPassword = (password = null, other = null)=>{
    return password === other
}

module.exports = {
    isValidEmail,
    isValidPassword,
    isEqualPassword
}