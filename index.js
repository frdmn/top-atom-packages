var request = require('request'),
    cheerio = require('cheerio'),
    async = require('async'),
    fs = require('fs'),
    numeral = require('numeral'),
    tableify = require('markdown-tableify');

// Configuration
var sortKey = "downloads";

// Parse possible pagination ranges
request('https://atom.io/packages/list?direction=desc&page=1&sort=stars', function (error, response, html) {
  var $ = cheerio.load(html);
  var $paginationLinks = $('.pagination a');
  var currentPage = 1,
      lastPage = $($paginationLinks[$paginationLinks.length - 2]).text();

  // Empty array to store parsed packages
  var packages = [];

  // Iterate through each available result page
  async.whilst(function () {
    return currentPage <= lastPage;
  },
  function (next) {
    // Scrape content of "new" page
    request('https://atom.io/packages/list?direction=desc&page=' + currentPage + '&sort=stars', function (error, response, body) {
      console.log('Scraping results page ' + currentPage + '...');

      // Check for possible errors
      if (!error && response.statusCode == 200) {
        var $ = cheerio.load(body);

        // For each package on current page
        $('.package-list .grid-cell').each(function(i, element){
          // Create object with package infos
          var package = {
            name: $(this).find('.card-name').text().trim(),
            nameLinkDOM: '[' + $(this).find('.card-name').text().trim() + '](https://atom.io/packages/' + $(this).find('.card-name').text().trim()  + ')',
            description: $(this).find('.card-description').text().trim(),
            author: $(this).find('.author').text().trim(),
            authorLink: $(this).find('.author').attr('href'),
            authorLinkDOM: '[<img src="' + $(this).find('.gravatar').attr('src') + '" data-canonical-src="' + $(this).find('.gravatar').attr('src') + '" width="25" height="25" /> ' + $(this).find('.author').text().trim() + '](https://atom.io' + $(this).find('.author').attr('href') + ')',
            downloads: $(this).find('.stat[aria-label="Downloads"] .value').text().trim().replace(/,/g, ''),
            stars: $(this).find('.star-box .social-count').text().trim().replace(/,/g, '')
          };

          // Push to array
          packages.push(package);
        });
      }

      // Increment current page
      currentPage++;
      next();
    });
  },
  function (err) {
    // Once the iteration is complete...
    console.log('Finished scraping');

    // Sort descending based on 'sortKey'
    packages.sort(function(a, b){
        return b[sortKey] - a[sortKey];
    });

    // Post-process values
    packages.forEach(function(entry, index) {
      // Add bold position key
      entry.position = '**' + (index + 1) + "**";
      // Format numbers and add decimal grouping
      entry.downloads = numeral(entry.downloads).format('0,0');
      entry.stars = numeral(entry.stars).format('0,0');
    });

    // Create markdown table
    var table = tableify(packages, {
      headers: [{
        name: 'position',
        align: ':---:',
        title: '#'
      }, {
        name: 'nameLinkDOM',
        align: ':---',
        title: 'Package Name'
      }, {
        name: 'authorLinkDOM',
        align: ':---',
        title: 'Author'
      }, {
        name: 'downloads',
        align: ':---'
      }, {
        name: 'stars',
        align: ':---'
      }]
    });

    // And write the constructed Markdown to file
    fs.writeFile('top-atom-packages.md', table, function(err) {
      console.log('Successfully stored packages in "top-atom-packages.md"!');
    });
  });
});
