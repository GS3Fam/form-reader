module.exports= (characters, type) => {
  let text = "", possible;
  type ? 0 : type = 'all'
  switch (type) {
    case 'numbers':
      possible = "0123456789"; break;
    case 'small':
      possible = "abcdefghijklmnopqrstuvwxyz"; break;
    case 'capital':
      possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; break;
    case 'small&numbers':
      possible = "abcdefghijklmnopqrstuvwxyz0123456789"; break;
    case 'capital&numbers':
      possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; break;
    case 'small&capital':
      possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; break;
    default:
      possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; break;
  }
  for (let i = 0; i < characters; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
