TrelloPowerUp.initialize({
  'card-badges': function(t, options){
      console.log(options);
    t.card('id', 'checklists').then(function (card) {
      console.log(JSON.stringify(card, null, 2));
    });
    
    return [
    {
      color: 'light-gray',
      text: '1/2 Initial spike',
    },
    {
      text: '☐ Peer to peer vs client-server?',
    },
    {
      text: '☑ Check this item',
    }];
  },
});


// ☐ Peer to peer vs client-server?                                                                                                    
// ☑ Check this item                                                                                                    
