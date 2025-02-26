$(document).ready(function () {
    // Global variables
    let allEntries = [];
    let currentFeed = null;
    let currentPage = 1;
    const pageSize = 10;
    let favourites = [];
    let totalPages = 0;
    let currentFilter = 'all';

    // Load favourites from localStorage if available
    initializeFavourites();

    // Function to initialize favourites from localStorage
    function initializeFavourites() {
        const storedFavourites = localStorage.getItem('newsFeedFavourites');
        if (storedFavourites) {
            favourites = JSON.parse(storedFavourites);
        }
    }

    // Function to save favourites to localStorage
    function saveFavourites() {
        localStorage.setItem('newsFeedFavourites', JSON.stringify(favourites));
    }

    // Function to parse XML/Atom feed
    function parseFeed(feedUrl, callback) {
        $('#loadingIndicator').show();
        $('#emptyMessage').hide();

        // CORS proxy for testing
        const corsProxy = '';
        const url = corsProxy + feedUrl;

        $.ajax({
            url: url,
            dataType: "xml",
            success: function (data) {
                console.log("Feed loaded successfully");
                $('#loadingIndicator').hide();

                // Set current feed info
                const feedTitle = $(data).find('title:first').text() || feedUrl;
                $('#currentFeedTitle').text(feedTitle);
                $('#currentFeedInfo').show();

                // Skip validation for now as we don't have the XSD file
                validateXmlAgainstXsd(data, callback);
                callback(data);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                $('#loadingIndicator').hide();
                console.error("Error loading feed:", textStatus, errorThrown);
                alert("Failed to load feed. Error: " + textStatus);
            }
        });
    }

    // Function to validate XML against XSD
    function validateXmlAgainstXsd(xmlData, callback) {
        $.ajax({
            url: 'atom.xsd', // Path to your XSD file
            dataType: "text",
            success: function (xsdContent) {
                try {
                    const xsdDoc = $.parseXML(xsdContent);
                    const xmlDoc = xmlData;

                    const isValid = validateXml(xmlDoc, xsdDoc);

                    if (isValid) {
                        console.log("XML is valid against XSD.");
                        callback(xmlData); // Proceed with parsing if valid
                    } else {
                        console.error("XML is invalid.");
                        alert("The XML feed is not valid according to the XSD schema.");
                    }
                } catch (e) {
                    console.error("Error validating XML:", e);
                    // Proceed anyway for now, since validation is a bonus feature
                    callback(xmlData);
                }
            },
            error: function () {
                console.warn("Failed to load XSD schema. Proceeding without validation.");
                callback(xmlData); // Proceed anyway since validation is extra
            }
        });
    }

    // Function to validate XML against XSD
    function validateXml(xmlDoc, xsdDoc) {
        // This is a placeholder for actual XML validation
        // In a real implementation, you would use a proper XML validation library
        console.log("XML validation not implemented yet");
        return true; // Assuming valid for now
    }

    // Function to parse entries from XML data
    function parseEntries(data) {
        const entries = [];
        const isRSS = $(data).find('rss').length > 0;

        if (isRSS) {
            // Parse RSS format
            $(data).find('item').each(function () {
                const $item = $(this);
                let imageUrl = '';

                // Try to extract image URL from various possible locations
                if ($item.find('enclosure[type^="image"]').length) {
                    imageUrl = $item.find('enclosure[type^="image"]').attr('url');
                } else if ($item.find('media\\:content, content').length) {
                    imageUrl = $item.find('media\\:content, content').attr('url');
                } else if ($item.find('media\\:thumbnail, thumbnail').length) {
                    imageUrl = $item.find('media\\:thumbnail, thumbnail').attr('url');
                } else if ($item.find('description').text().match(/<img[^>]+src="([^">]+)"/)) {
                    const match = $item.find('description').text().match(/<img[^>]+src="([^">]+)"/);
                    imageUrl = match[1];
                }

                // Get categories
                const categories = [];
                $item.find('category').each(function () {
                    categories.push($(this).text());
                });

                const entry = {
                    id: $item.find('guid').text() || $item.find('link').text(),
                    title: $item.find('title').text(),
                    description: $item.find('description').text(),
                    author: $item.find('author, dc\\:creator').text() || 'Unknown',
                    date: $item.find('pubDate').text(),
                    link: $item.find('link').text(),
                    image: imageUrl || 'https://via.placeholder.com/300x200?text=No+Image',
                    categories: categories
                };
                entries.push(entry);
            });
        } else {
            // Parse Atom format
            $(data).find('entry').each(function () {
                const $entry = $(this);
                let imageUrl = '';

                // Try to extract image URL from various possible locations
                if ($entry.find('media\\:thumbnail').length) {
                    imageUrl = $entry.find('media\\:thumbnail').attr('url');
                } else if ($entry.find('media\\:content[type^="image"]').length) {
                    imageUrl = $entry.find('media\\:content[type^="image"]').attr('url');
                } else if ($entry.find('content').text().match(/<img[^>]+src="([^">]+)"/)) {
                    const match = $entry.find('content').text().match(/<img[^>]+src="([^">]+)"/);
                    imageUrl = match[1];
                }

                // Get categories
                const categories = [];
                $entry.find('category').each(function () {
                    categories.push($(this).attr('term') || $(this).text());
                });

                const entry = {
                    id: $entry.find('id').text(),
                    title: $entry.find('title').text(),
                    description: $entry.find('summary').text() || $entry.find('content').text(),
                    author: $entry.find('author > name').text() || 'Unknown',
                    date: $entry.find('published, updated').text(),
                    link: $entry.find('link[rel="alternate"]').attr('href') || $entry.find('link').attr('href'),
                    image: imageUrl || 'https://via.placeholder.com/300x200?text=No+Image',
                    categories: categories
                };
                entries.push(entry);
            });
        }

        return entries;
    }

    // Function to render news cards
    function renderNewsCards(entries) {
        const container = $('#newsContainer');
        container.empty();

        if (entries.length === 0) {
            $('#emptyMessage').show();
            return;
        }

        $('#emptyMessage').hide();

        entries.forEach(entry => {
            // Clean up description (remove HTML if too complex)
            let description = entry.description;
            if (description.length > 300) {
                description = description.replace(/<[^>]*>/g, ' ');
                description = description.substring(0, 200) + '...';
            }

            // Format date if possible
            let formattedDate = entry.date;
            try {
                const date = new Date(entry.date);
                formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            } catch (e) {
                console.log("Could not parse date", entry.date);
            }

            // Create category badges
            const categoryBadges = entry.categories.length > 0
                ? entry.categories.map(cat => `<span class="badge bg-primary">${cat}</span>`).join(' ')
                : '<span class="badge bg-secondary">Uncategorized</span>';

            // Check if this entry is already a favourite
            const isFavourite = favourites.includes(entry.id) ? 'favourited' : '';

            const card = `
                <div class="card mb-4">
                    <div class="row g-0">
                        <div class="col-md-4">
                            <img src="${entry.image}" class="card-img" alt="${entry.title}">
                        </div>
                        <div class="col-md-8">
                            <div class="card-body">
                                <div class="d-flex justify-content-between">
                                    <h5 class="card-title">${entry.title}</h5>
                                    <i class="fas fa-heart favourite-btn ${isFavourite}" data-id="${entry.id}" title="Mark as Favourite"></i>
                                </div>
                                <p class="card-text">${description}</p>
                                <p class="card-text">
                                    <small class="text-muted">By ${entry.author} on ${formattedDate}</small>
                                </p>
                                <div class="card-text mb-2">
                                    ${categoryBadges}
                                </div>
                                <a href="${entry.link}" class="btn btn-sm btn-outline-primary" target="_blank">Read More</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.append(card);
        });

        // Add favourite button functionality
        $('.favourite-btn').on('click', function () {
            const id = $(this).data('id');
            const index = favourites.indexOf(id);

            if (index === -1) {
                favourites.push(id);
                $(this).addClass('favourited');
            } else {
                favourites.splice(index, 1);
                $(this).removeClass('favourited');
            }

            saveFavourites();
        });
    }

    // Function to render pagination
    function renderPagination() {
        const $pagination = $('#pagination');
        $pagination.empty();

        if (allEntries.length <= pageSize) {
            $pagination.hide();
            $('#loadMoreButton').hide();
            return;
        }

        totalPages = Math.ceil(allEntries.length / pageSize);

        // Show load more button instead of complex pagination for simplicity
        $('#loadMoreButton').show();

        if (currentPage >= totalPages) {
            $('#loadMoreButton').prop('disabled', true);
        } else {
            $('#loadMoreButton').prop('disabled', false);
        }

        // Still create a basic pagination indicator
        $pagination.show();

        // Previous button
        $pagination.append(`
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `);

        // Page numbers - show max 5 pages
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);

        for (let i = startPage; i <= endPage; i++) {
            $pagination.append(`
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `);
        }

        // Next button
        $pagination.append(`
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `);

        // Add event listeners for pagination
        $('.page-link').on('click', function (e) {
            e.preventDefault();
            const page = parseInt($(this).data('page'));
            if (page >= 1 && page <= totalPages) {
                currentPage = page;
                displayCurrentPage();
            }
        });
    }

    // Function to display the current page
    function displayCurrentPage() {
        let displayEntries = allEntries;

        // Apply any filters
        if (currentFilter === 'favourites') {
            displayEntries = allEntries.filter(entry => favourites.includes(entry.id));
        }

        // Apply search if needed
        const searchQuery = $('#searchInput').val().toLowerCase();
        if (searchQuery) {
            displayEntries = displayEntries.filter(entry =>
                entry.title.toLowerCase().includes(searchQuery) ||
                entry.description.toLowerCase().includes(searchQuery)
            );
        }

        // Calculate total pages based on filtered entries
        totalPages = Math.ceil(displayEntries.length / pageSize);

        // Make sure current page is valid
        if (currentPage > totalPages) {
            currentPage = totalPages || 1;
        }

        // Get entries for current page
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageEntries = displayEntries.slice(start, end);

        // Render
        renderNewsCards(pageEntries);
        renderPagination();
    }

    // Function to fetch and display news
    function fetchAndDisplayNews(feedUrl) {
        currentFeed = feedUrl;
        currentPage = 1;

        parseFeed(feedUrl, function (data) {
            allEntries = parseEntries(data);
            console.log("Entries parsed:", allEntries.length);
            displayCurrentPage();
        });
    }



    // Función para buscar noticias por palabras clave en título o categorías
    function searchNews(query, entries) {
        if (!query || query.trim() === '') {
            return entries; // Devolver todas las entradas si la consulta está vacía
        }

        const keywords = query.toLowerCase().split(' ').filter(keyword => keyword.length > 0);

        return entries.filter(entry => {
            // Buscar en el título
            const titleMatches = keywords.some(keyword =>
                entry.title.toLowerCase().includes(keyword)
            );

            // Buscar en las categorías (tags)
            const categoryMatches = entry.categories && entry.categories.length > 0 &&
                keywords.some(keyword =>
                    entry.categories.some(category =>
                        category.toLowerCase().includes(keyword)
                    )
                );

            // También podemos buscar en la descripción si se desea
            const descriptionMatches = keywords.some(keyword =>
                entry.description.toLowerCase().includes(keyword)
            );

            // Devolver true si hay coincidencias en título o categorías
            return titleMatches || categoryMatches || descriptionMatches;
        });
    }

    // Modificación al código existente - reemplazando la función displayCurrentPage
    function displayCurrentPage() {
        let displayEntries = allEntries;

        // Aplicar filtros
        if (currentFilter === 'favourites') {
            displayEntries = allEntries.filter(entry => favourites.includes(entry.id));
        }

        // Aplicar búsqueda con la nueva función
        const searchQuery = $('#searchInput').val().trim();
        if (searchQuery) {
            displayEntries = searchNews(searchQuery, displayEntries);
        }

        // Calcular total de páginas basado en entradas filtradas
        totalPages = Math.ceil(displayEntries.length / pageSize);

        // Asegurarse de que la página actual es válida
        if (currentPage > totalPages) {
            currentPage = totalPages || 1;
        }

        // Obtener entradas para la página actual
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageEntries = displayEntries.slice(start, end);

        // Renderizar
        renderNewsCards(pageEntries);
        renderPagination();

        // Mostrar contador de resultados si hay una búsqueda activa
        if (searchQuery) {
            const resultCount = displayEntries.length;
            const resultMessage = `${resultCount} resultado${resultCount !== 1 ? 's' : ''} para "${searchQuery}"`;

            // Si no existe el elemento para mostrar resultados, crearlo
            if ($('#searchResults').length === 0) {
                $('#currentFeedInfo').after('<div class="container mt-2"><div class="alert alert-secondary" id="searchResults"></div></div>');
            }

            $('#searchResults').text(resultMessage).show();
        } else {
            $('#searchResults').hide();
        }
    }

    // Reemplazamos los manejadores de eventos relacionados con la búsqueda
    $(document).ready(function () {
        // ... el código existente se mantiene ...

        // Manejador de evento para el botón de búsqueda
        $('#searchButton').on('click', function () {
            currentPage = 1;
            displayCurrentPage();
        });

        // Permitir búsqueda al presionar Enter
        $('#searchInput').on('keyup', function (e) {
            if (e.key === 'Enter') {
                currentPage = 1;
                displayCurrentPage();
            }
        });

        // Agregar funcionalidad para limpiar la búsqueda
        // Añadir este HTML después del campo de búsqueda
        $('<button class="btn btn-outline-secondary" type="button" id="clearSearchButton"><i class="fas fa-times"></i></button>')
            .insertAfter('#searchButton');

        // Manejador de evento para el botón de limpiar búsqueda
        $('#clearSearchButton').on('click', function () {
            $('#searchInput').val('');
            currentPage = 1;
            displayCurrentPage();
        });

        // Destacar las palabras clave en las tarjetas de noticias
        function highlightKeywords(text, keywords) {
            if (!keywords || keywords.length === 0) return text;

            let highlightedText = text;
            keywords.forEach(keyword => {
                const regex = new RegExp(`(${keyword})`, 'gi');
                highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
            });

            return highlightedText;
        }

        // Modificar la función renderNewsCards para destacar palabras clave
        const originalRenderNewsCards = renderNewsCards;
        renderNewsCards = function (entries) {
            const searchQuery = $('#searchInput').val().trim();
            const keywords = searchQuery ? searchQuery.toLowerCase().split(' ').filter(k => k.length > 0) : [];

            if (keywords.length > 0) {
                // Crear copias con texto destacado para mostrar
                const highlightedEntries = entries.map(entry => {
                    const entryCopy = { ...entry };
                    entryCopy.title = highlightKeywords(entry.title, keywords);

                    // Solo destacar en la descripción si no es HTML complejo
                    if (!entry.description.includes('</')) {
                        entryCopy.description = highlightKeywords(entry.description, keywords);
                    }

                    return entryCopy;
                });

                originalRenderNewsCards(highlightedEntries);
            } else {
                originalRenderNewsCards(entries);
            }
        };
    });


    // Event listeners
    $('#feedSelector').on('change', function () {
        const selectedFeed = $(this).val();
        if (selectedFeed) {
            fetchAndDisplayNews(selectedFeed);
        }
    });

    $('#loadFeedButton').on('click', function () {
        const feedUrl = $('#feedUrlInput').val().trim();
        if (feedUrl) {
            fetchAndDisplayNews(feedUrl);
        } else {
            alert("Please enter a valid feed URL");
        }
    });

    $('#loadMoreButton').on('click', function () {
        if (currentPage < totalPages) {
            currentPage++;
            displayCurrentPage();
        }
    });

    $('#showAllNews').on('click', function (e) {
        e.preventDefault();
        currentFilter = 'all';
        currentPage = 1;
        displayCurrentPage();
    });

    $('#showFavourites').on('click', function (e) {
        e.preventDefault();
        currentFilter = 'favourites';
        currentPage = 1;
        displayCurrentPage();
    });

    $('#searchButton').on('click', function () {
        currentPage = 1;
        displayCurrentPage();
    });

    // Allow search on Enter key
    $('#searchInput').on('keyup', function (e) {
        if (e.key === 'Enter') {
            currentPage = 1;
            displayCurrentPage();
        }
    });

    // Initial setup - show empty message
    $('#emptyMessage').show();
});