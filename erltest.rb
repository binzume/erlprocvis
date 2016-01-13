#!/usr/bin/env ruby
require_relative 'erlang'

# ext_binary
Erlang::from_binary(StringIO.new(Erlang::to_binary(123456))) == 123456 or raise "int"
Erlang::from_binary(StringIO.new(Erlang::to_binary(-123456))) == -123456 or raise "-int"
Erlang::from_binary(StringIO.new(Erlang::to_binary("hello"))) == "hello" or raise "str"
Erlang::from_binary(StringIO.new(Erlang::to_binary(1000000000000000000))) == 1000000000000000000 or raise "bignum"
Erlang::from_binary(StringIO.new(Erlang::to_binary(-1000000000000000000))) == -1000000000000000000 or raise "-bignum"
Erlang::from_binary(StringIO.new(Erlang::to_binary(:abc))) == :abc or raise "atom"
Erlang::from_binary(StringIO.new(Erlang::to_binary([1,"2",3]))) == [1,"2",3] or raise "list"
Erlang::from_binary(StringIO.new(Erlang::to_binary({a: 1, b: "abc"}))) == {a: 1, b: "abc"} or raise "map"
Erlang::from_binary(StringIO.new(Erlang::to_binary(true))) == :true or raise "bool"

# connect
node = "hoge@fuga"
cookie = File.read(ENV['HOME']+"/.erlang.cookie")
erl = Erlang::Erl.new(node, cookie)
if erl.nodes.empty?
  raise "no available node."
end

p erl.nodes
if erl.rpc_call(erl.nodes[0], :io, :format, ["Hello!\n"]) != :ok
  raise " != :ok"
end

node = erl.nodes[0]

# rpc_call
p erl.rpc_call(node, :erlang, :processes, [])

p erl.rpc_call(node, :maps, :from_list, [[Erlang::Tuple[:a,2],Erlang::Tuple[:b,4]]])
p erl.rpc_call(node, :maps, :to_list, [{a: 123, b: 456}])

p erl.rpc_call(node, :maps, :to_list, [{bool: true, a: -18956777777777777777777, binary: Erlang::Binary.new("BinaryString")}])

# eval
erl.eval(node, "1+1.") == 2 or raise "eval"
erl.eval(node, "fun(A)-> A*2 end.", [123]) == 123*2 or raise "eval+apply"
puts "ok."

