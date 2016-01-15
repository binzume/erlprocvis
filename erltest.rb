#!/usr/bin/env ruby
require_relative 'erlang'

# test data
dataset = [
  [123456, "int"],
  [-123456, "-int"],
  [2.7182818, "float"],
  ["hello", "str"],
  [1000000000000000000, "bigint"],
  [-1000000000000000000, "-bigint"],
  [:abc, "atom"],
  [[1,"2",3], "list"],
  [{a: 1, b: "abc"}, "map"],
  [Erlang::Tuple[:a, 1, 2], "tuple"],
  [Erlang::Binary.new("bin"), "binary"]
]

# ext_binary
dataset.each{|v, txt|
  Erlang::from_binary(StringIO.new(Erlang::to_binary(v))) == v or raise txt
}
Erlang::from_binary(StringIO.new(Erlang::to_binary(true))) == :true or raise "bool"
Erlang::from_binary(StringIO.new(Erlang::to_binary(false))) == :false or raise "bool"
Erlang::from_binary(StringIO.new(Erlang::to_binary(nil))) == [] or raise "nil"

# connect
node = "rubynode@test"
cookie = File.read(ENV['HOME']+"/.erlang.cookie")
erl = Erlang::Erl.new(node, cookie)
if erl.nodes.empty?
  raise "no available node."
end

p erl.nodes
node = erl.nodes[0]

# rpc_call
if erl.rpc_call(erl.nodes[0], :io, :format, ["Hello!\n"]) != :ok
  raise " != :ok"
end

dataset.each{|v, txt|
  puts txt
  erl.rpc_call(node, :erlang, :hd, [ [v] ]) == v or raise txt
}

p erl.rpc_call(node, :erlang, :processes, [])

# eval
erl.eval(node, "1+1.") == 2 or raise "eval"
erl.eval(node, "fun(A)-> A*2 end.", [123]) == 123*2 or raise "eval+apply"

erl.down()

puts "ok."

