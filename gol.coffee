require 'coffee-script'
T = require './ristrettoAssert'
_ = require 'underscore'

# Define a type for a living cell
T 'typedef Cell :: {x:Int, y:Int}'
class Cell
    constructor: (@x,@y) ->

# seed the initial living cells
r_pentomino = [new Cell(2, 1), new Cell(3, 1), new Cell(1,2), new Cell(2,2), new Cell(2,3)]

# determine if a coordinate (x,y) is a neighbour of a cell
is_neighbour = T('is_neighbour :: Cell -> Int -> Int -> Bool', (c, x, y) ->
    Math.abs(x-c.x) < 2 and Math.abs(y-c.y) < 2 and (not (x is c.x and y is c.y))
)

living_neighbours = T('living_neighbours :: [Cell] -> Int -> Int -> Int', (cs,x,y) ->
    (cell for cell in cs when is_neighbour cell, x, y).length
)

is_on = T('is_on :: [Cell] -> Int -> Int -> Bool', (cs,x,y) ->
    (cell for cell in cs when cell.x is x and cell.y is y).length > 0
)

largest_x = T 'largest_x :: [Cell] -> Int', (cs) ->
    _.max(cs, (i) -> i.x).x

largest_y = T 'largest_y :: [Cell] -> Int', (cs) ->
    _.max(cs, (i) -> i.y).y

alive_next_generation = T 'alive_next_generation :: [Cell] -> Int -> Int -> Bool', (cs,x,y) ->
    false
    (is_on(cs, x, y) and 2 <= living_neighbours(cs, x, y) <=3) or ((not is_on(cs, x, y)) and (living_neighbours(cs,x,y) is 3))

tick = T 'tick :: [Cell] -> [Cell]', (cs) ->
    ncs = []
    for x in [0..largest_x(cs)+1]
        for y in [0..largest_y(cs)+1]
            ncs.push(new Cell(x,y)) if alive_next_generation cs, x, y
    ncs

visualize = T 'visualize :: [Cell] -> String', (cs) ->
    result = ''
    for y in [0..largest_y(cs)+1]
        for x in [0..largest_x(cs)+1]
            result += if is_on(cs,x,y) then 'x' else '-'
            if x is largest_x(cs)+1
                result += '\n'
    result

[1..50].reduce((p,c,i) ->
    console.log visualize p
    tick p
, r_pentomino)


