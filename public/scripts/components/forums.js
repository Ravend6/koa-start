(function () {
  'use strict';

  $('#forums-access').multiselect({
    nonSelectedText: 'Выберите доступ',
    allSelectedText: 'Доступно всем'
  });

  $('#forums-moderators').multiselect({
    nonSelectedText: 'Выберите модераторов',
    allSelectedText: 'Выбраны все модераторы'
  });
}());